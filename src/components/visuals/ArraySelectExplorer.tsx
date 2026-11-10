"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { BitStrip, BitStripLegend, type BitSegment } from "@/components/visual-system/BitStrip";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  ARRAY_SELECT_PRESETS,
  PART_CASES,
  PER_DIMENSION,
  QUERY_FUNCTIONS,
  QUERY_TARGETS,
  SELECT_CASES,
  SELECT_KIND_LABELS,
  callText,
  evaluateCase,
  evaluatePartCase,
  findQueryTarget,
  findSelectCase,
  formatBits,
  isAscending,
  lessonDecl,
  memByte,
  orderedOptions,
  parseQueryAnswer,
  partBase,
  partOptions,
  queryArray,
  queryValueText,
  rangeIndices,
  resolvePreset,
  selectExpr,
  selectOptions,
  selectQuestion,
  vectorBits,
  vectorDecl,
  wordBits,
  type Bit,
  type ExplorerMode,
  type PartCase,
  type QueryFunction,
  type QueryTarget,
  type QueryValue,
  type SelectCase,
  type SelectResult,
  type StateKind,
} from "@/lib/sv-array-select-model";
import { cn } from "@/lib/utils";

export const ARRAY_SELECT_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §7.4.4 (unpacked indices first, then packed; the rightmost dimension varies fastest), §7.4.5 and Table 7-1 (slices keep their kind; invalid indexes into unpacked arrays read 'x or '0) and §11.5.1 (invalid bit-selects, out-of-range part-selects, indexed part-selects +: and -:).",
  "Query functions follow §20.7 and §20.7.1 (§7.11 points to §20.7). An int is treated as a packed [31:0] dimension, as §20.7 says.",
  "§11.5.1 gives x for an out-of-range part-select and states no separate 2-state value, so for a bit array the explorer says the value is not stated instead of choosing one.",
  "§11.5.1 NOTE 1 and NOTE 2 let a tool flag constant out-of-range or x indices at compile time; the explorer shows the run-time read the standard defines.",
  "The model covers the selects listed here; unpacked slices out of range, strings, real and class elements are not modelled.",
];

const code = (text: React.ReactNode) => <code className="rounded bg-muted px-1 font-mono text-[0.95em] [font-variant-ligatures:none]">{text}</code>;

/** Mounted only inside a prompt's revealed part, so the parent knows when the answer is on screen. */
function RevealSignal({ onChange }: { onChange: (revealed: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

function Given({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Given</p>
      <ul className="mt-1 space-y-0.5 font-mono text-xs text-foreground [font-variant-ligatures:none]">
        {lines.map((l) => (
          <li key={l} className="break-words">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <ul className="space-y-1">
      {notes.map((n) => (
        <li key={n} role="note" className="rounded-md border border-amber-500/40 bg-amber-500/[0.06] px-2 py-1 text-xs text-amber-900 dark:text-amber-100">
          <span aria-hidden>⚠ </span>
          {n}
        </li>
      ))}
    </ul>
  );
}

const hatch = "border-rose-500/80 text-rose-700 dark:text-rose-200 bg-[repeating-linear-gradient(135deg,rgba(244,63,94,0.18)_0_4px,transparent_4px_8px)]";
const lit = "border-cyan-500 bg-cyan-500/20 font-semibold text-foreground ring-2 ring-cyan-500/60";

/* ------------------------------------------------------------------ */
/* select mode                                                         */
/* ------------------------------------------------------------------ */

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");

/** The array behind a case, drawn before (no highlight) and after the reveal (highlights from the model's result). */
function SelectDrawing({ c, state, result, revealed }: { c: SelectCase; state: StateKind; result: SelectResult; revealed: boolean }) {
  const decl = lessonDecl(c.decl, state);
  const read = new Set(revealed ? result.wordBits : []);
  const rowsRead = revealed ? result.rows : [];
  const isRowRead = (u: number[]) => rowsRead.some((r) => r.length === u.length && r.every((v, k) => v === u[k]));

  if (c.decl === "w") {
    const bits = wordBits(decl.word([]), 32);
    const segments: BitSegment[] = [3, 2, 1, 0].map((lane) => ({ hi: lane * 8 + 7, lo: lane * 8, label: revealed ? `w[${lane}]` : "lane" }));
    return (
      <div className="space-y-2">
        <BitStrip
          bits={bits}
          label={`${decl.declText}, one 32-bit vector`}
          segments={segments}
          highlight={Array.from(read)}
          highlightLabel={`read by ${result.expr}`}
          bitNumbers
        />
        {revealed && result.missingElements.length ? (
          <p className={cn("rounded-md border px-2 py-1 font-mono text-xs", hatch)}>
            elements {result.missingElements[0]} to {result.missingElements[result.missingElements.length - 1]} of [3:0]: do not exist, read x
          </p>
        ) : null}
      </div>
    );
  }

  if (c.decl === "b") {
    const indices = rangeIndices(decl.unpacked[0]);
    const bad = revealed && result.invalid && !result.invalid.packed ? result.invalid.index : undefined;
    return (
      <div role="img" aria-label={`${decl.declText}: four separate 8-bit elements${revealed ? `; ${result.expr} ${result.rows.length ? `reads element${result.rows.length > 1 ? "s" : ""} ${result.rows.map((r) => r[0]).join(" and ")}` : "reads no element"}` : ""}`} className="flex flex-wrap gap-2">
        {indices.map((i) => (
          <div key={i} className={cn("min-w-16 rounded-lg border px-2 py-1.5 text-center font-mono text-xs [font-variant-ligatures:none]", isRowRead([i]) ? lit : "border-slate-400/60 bg-slate-500/10")}>
            <div className="text-[10px] text-muted-foreground">{revealed ? `b[${i}]` : "element"}</div>
            {hex2(decl.word([i]))}
          </div>
        ))}
        {bad !== undefined ? (
          <div className={cn("min-w-16 rounded-lg border border-dashed px-2 py-1.5 text-center font-mono text-xs", state === "logic" ? hatch : "border-slate-400/80")}>
            <div className="text-[10px]">{typeof bad === "object" ? "" : `b[${c.items[0].kind === "index" ? (c.items[0].name ?? bad) : bad}]`}</div>
            no element
          </div>
        ) : null}
      </div>
    );
  }

  if (c.decl === "mem") {
    const lanesRead = new Set(Array.from(read).map((p) => Math.floor(p / 8)));
    const bitInByte = result.kind === "bit" && read.size === 1 ? Array.from(read)[0] : undefined;
    return (
      <div className="space-y-2">
        <div className="max-w-full overflow-x-auto">
          <table aria-label={`${decl.declText}: 16 words in rows, four byte lanes in columns`} className="border-separate border-spacing-0.5 font-mono text-[11px] [font-variant-ligatures:none]">
            <thead>
              <tr>
                <th scope="col" className="px-1 text-left font-normal text-muted-foreground">
                  word
                </th>
                {[3, 2, 1, 0].map((lane) => (
                  <th key={lane} scope="col" className="px-1 font-normal text-muted-foreground">
                    {revealed ? `[${lane}]` : `${lane * 8 + 7}:${lane * 8}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rangeIndices(decl.unpacked[0]).map((i) => {
                const rowLit = isRowRead([i]);
                return (
                  <tr key={i} aria-current={rowLit ? "true" : undefined}>
                    <th scope="row" className={cn("px-1 text-left font-normal", rowLit ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {revealed ? `mem[${i}]` : i}
                    </th>
                    {[3, 2, 1, 0].map((lane) => (
                      <td key={lane} className={cn("rounded border px-1.5 py-0.5 text-center", rowLit && lanesRead.has(lane) ? lit : rowLit ? "border-cyan-500/50 bg-cyan-500/5" : "border-border/50")}>
                        {hex2(memByte(i, lane))}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {revealed && bitInByte !== undefined && result.rows[0] ? (
          <BitStrip
            bits={wordBits(memByte(result.rows[0][0], Math.floor(bitInByte / 8)), 8)}
            label={`mem[${result.rows[0][0]}][${Math.floor(bitInByte / 8)}]`}
            msbIndex={7}
            highlight={[bitInByte % 8]}
            highlightLabel={`read: bit ${bitInByte} of mem[${result.rows[0][0]}]`}
            bitNumbers
          />
        ) : null}
      </div>
    );
  }

  // grid
  const rows = rangeIndices(decl.unpacked[0]);
  const cols = rangeIndices(decl.unpacked[1]);
  return (
    <table aria-label={`${decl.declText}: 4 rows of 8 ints`} className="border-separate border-spacing-0.5 font-mono text-[11px] [font-variant-ligatures:none]">
      <tbody>
        {rows.map((r) => (
          <tr key={r}>
            <th scope="row" className="px-1 text-left font-normal text-muted-foreground">
              {revealed ? `grid[${r}]` : ""}
            </th>
            {cols.map((cc) => {
              const on = isRowRead([r, cc]);
              return (
                <td key={cc} aria-current={on ? "true" : undefined} className={cn("w-7 rounded border py-0.5 text-center", on ? lit : "border-border/50")}>
                  {decl.word([r, cc])}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SelectReveal({ result }: { result: SelectResult }) {
  const v = result.value;
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Reads</dt>
        <dd className="font-mono font-semibold [font-variant-ligatures:none]" data-testid="select-value">
          {result.valueText}
        </dd>
        <dt className="text-muted-foreground">Kind</dt>
        <dd>{SELECT_KIND_LABELS[result.kind]}</dd>
        <dt className="text-muted-foreground">Type</dt>
        <dd className="font-mono [font-variant-ligatures:none]">{result.typeText}</dd>
        {result.bitArithmetic ? (
          <>
            <dt className="text-muted-foreground">Bit number</dt>
            <dd className="font-mono [font-variant-ligatures:none]">{result.bitArithmetic}</dd>
          </>
        ) : null}
      </dl>
      {v && v.shape === "packed" && v.bits.length > 1 && !result.twoStateUnstated && !v.intLike ? (
        <BitStrip bits={v.bits as Bit[]} label={`${result.expr}, the value read`} />
      ) : null}
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground" aria-label="Why">
        {result.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <Notes notes={result.notes} />
    </div>
  );
}

function SelectMode({ initialCase }: { initialCase: string }) {
  const [caseId, setCaseId] = useState(initialCase);
  const [state, setState] = useState<StateKind>("logic");
  const [revealed, setRevealed] = useState(false);
  const onReveal = useCallback((r: boolean) => setRevealed(r), []);
  const c = findSelectCase(caseId) ?? SELECT_CASES[0];
  const effectiveState: StateKind = c.decl === "grid" ? "bit" : state;
  const result = useMemo(() => evaluateCase(c, effectiveState), [c, effectiveState]);
  const options: PredictionOption[] = useMemo(
    () => orderedOptions(selectOptions(c, effectiveState), `${c.id}-${effectiveState}`).map((o) => ({ id: o.id, label: <span className="font-mono [font-variant-ligatures:none]">{o.label}</span>, correct: o.correct, feedback: o.feedback })),
    [c, effectiveState],
  );
  const decl = lessonDecl(c.decl, effectiveState);
  const resetKey = `${c.id}-${effectiveState}`;
  const question = selectQuestion(c, effectiveState);

  return (
    <div className="space-y-4">
      <SegmentedControl
        label="Select expression"
        mono
        value={c.id}
        onChange={setCaseId}
        options={SELECT_CASES.map((sc) => ({ value: sc.id, label: selectExpr(lessonDecl(sc.decl), sc.items) }))}
      />
      <div className="flex flex-wrap items-center gap-3">
        {c.decl === "grid" ? (
          <span className="text-xs text-muted-foreground">grid is int, which is always 2-state, so the logic/bit toggle does not apply here.</span>
        ) : (
          <SegmentedControl
            label="Element type"
            mono
            value={state}
            onChange={setState}
            options={[
              { value: "logic", label: "logic (4-state)", ariaLabel: "logic, 4-state" },
              { value: "bit", label: "bit (2-state)", ariaLabel: "bit, 2-state" },
            ]}
          />
        )}
      </div>
      <Given lines={[`${decl.declText};`, decl.valueText, ...(c.given ? [c.given] : [])]} />
      <SelectDrawing c={c} state={effectiveState} result={result} revealed={revealed} />
      <PredictionPrompt
        key={resetKey}
        resetKey={resetKey}
        question={
          <>
            {question.lead}
            {code(question.expr)}
            {question.tail}
          </>
        }
        options={options}
      >
        <RevealSignal onChange={onReveal} />
        <SelectReveal result={result} />
      </PredictionPrompt>
      <p className="sr-only" aria-live="polite" data-testid="array-select-live">
        {revealed ? `Revealed: ${result.expr} reads ${result.valueText}.` : `Predict what ${result.expr} reads.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* part-select mode                                                    */
/* ------------------------------------------------------------------ */

function PartMode({ initialCase, initialSlider }: { initialCase: string; initialSlider: number }) {
  const start = PART_CASES.find((p) => p.id === initialCase) ?? PART_CASES[0];
  const [vector, setVector] = useState<"v" | "up_vect">(start.vector);
  const [caseId, setCaseId] = useState(start.id);
  const [slider, setSlider] = useState(initialSlider);
  const [revealed, setRevealed] = useState(false);
  const onReveal = useCallback((r: boolean) => setRevealed(r), []);
  const sliderId = useId();
  const cases = PART_CASES.filter((p) => p.vector === vector);
  const c: PartCase = cases.find((p) => p.id === caseId) ?? cases[0];
  const sliderSpec = typeof c.base === "object" ? c.base.slider : null;
  const s = sliderSpec ? Math.min(Math.max(slider, sliderSpec.min), sliderSpec.max) : 0;
  const result = useMemo(() => evaluatePartCase(c, s), [c, s]);
  const options: PredictionOption[] = useMemo(
    () => orderedOptions(partOptions(c, s), `${c.id}-${s}`).map((o) => ({ id: o.id, label: <span className="font-mono [font-variant-ligatures:none]">{o.label}</span>, correct: o.correct, feedback: o.feedback })),
    [c, s],
  );
  const d = vectorDecl(vector);
  const width = Math.abs(d.msb - d.lsb) + 1;
  const segments: BitSegment[] = Array.from({ length: width / 8 }, (_, k) => {
    const a = isAscending(d) ? d.msb + 8 * k : d.msb - 8 * k;
    const b = isAscending(d) ? a + 7 : a - 7;
    return { hi: a, lo: b, label: "byte" };
  });
  const inRangeRead = revealed ? result.indices.filter((i) => !result.outOfRange.includes(i)) : [];
  const resetKey = `${c.id}-${s}`;
  const base = partBase(c, s);

  return (
    <div className="space-y-4">
      <SegmentedControl
        label="Declaration"
        mono
        value={vector}
        onChange={(v) => {
          setVector(v);
          setCaseId((PART_CASES.find((p) => p.vector === v) ?? PART_CASES[0]).id);
        }}
        options={[
          { value: "v", label: "logic [31:0] v" },
          { value: "up_vect", label: "logic [0:15] up_vect" },
        ]}
      />
      <SegmentedControl label="Indexed part-select" mono value={c.id} onChange={setCaseId} options={cases.map((p) => ({ value: p.id, label: evaluatePartCase(p, 0).expr }))} />
      {sliderSpec ? (
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={sliderId} className="font-mono text-sm [font-variant-ligatures:none]">
            {sliderSpec.name} = {s}
          </label>
          <input
            id={sliderId}
            type="range"
            min={sliderSpec.min}
            max={sliderSpec.max}
            step={1}
            value={s}
            onChange={(e) => setSlider(Number(e.target.value))}
            aria-valuetext={`${sliderSpec.name} = ${s}, base ${base}`}
            className="w-40 accent-cyan-500"
          />
          <span className="font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">base = {base}</span>
        </div>
      ) : null}
      <Given lines={[`${d.declText} = ${formatBits(vectorBits(d))};`, ...(base === "x" ? ["i holds 'x"] : [])]} />
      <BitStrip
        bits={vectorBits(d)}
        label={`${d.declText}, ${isAscending(d) ? "ascending: bit 0 is the most significant" : "descending: bit 31 is the most significant"}`}
        ascending={isAscending(d)}
        msbIndex={d.msb}
        segments={segments}
        highlight={inRangeRead}
        highlightLabel={`read by ${result.expr}`}
        bitNumbers
      />
      <PredictionPrompt key={resetKey} resetKey={resetKey} question={<>Which bits does {code(result.expr)} read?</>} options={options}>
        <RevealSignal onChange={onReveal} />
        <div className="space-y-3 text-sm">
          <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
            {result.equivalent ? (
              <>
                <dt className="text-muted-foreground">Equals</dt>
                <dd className="font-mono font-semibold [font-variant-ligatures:none]">{result.equivalent}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Reads</dt>
            <dd className="font-mono font-semibold [font-variant-ligatures:none]" data-testid="part-value">
              {result.valueText}
            </dd>
            <dt className="text-muted-foreground">Where</dt>
            <dd>{result.place}</dd>
          </dl>
          {result.bits.length ? (
            <BitStrip
              bits={result.bits}
              label={`${result.expr}, the value read${result.indices.length ? `, bits ${result.indices[0]} to ${result.indices[result.indices.length - 1]} of ${d.name}` : ""}`}
            />
          ) : null}
          <p className="text-muted-foreground">{result.explanation}</p>
          <Notes notes={result.notes} />
        </div>
      </PredictionPrompt>
      <BitStripLegend items={["x", "highlight"]} />
      <p className="sr-only" aria-live="polite" data-testid="array-select-live">
        {revealed ? `Revealed: ${result.expr} reads ${result.valueText}.` : `Predict which bits ${result.expr} reads.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* query mode                                                          */
/* ------------------------------------------------------------------ */

function DimColumn({ title, active, children }: { title: string; active: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0 rounded-lg border p-2", active ? "border-cyan-500 bg-cyan-500/10" : "border-border/60")}>
      <p className={cn("mb-1 font-mono text-[11px] [font-variant-ligatures:none]", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{title}</p>
      {children}
    </div>
  );
}

const chip = "inline-flex min-w-8 items-center justify-center rounded border border-slate-400/60 bg-slate-500/10 px-1.5 py-0.5 font-mono text-[11px] [font-variant-ligatures:none]";

/** Nested columns, slowest-varying dimension first. The chosen dimension is outlined; nothing here shows a query result. */
function QueryLayout({ target, dimension }: { target: QueryTarget; dimension: number }) {
  const dimTitle = (k: number) => {
    const d = target.dims[k];
    const n = `dim ${k + 1}`;
    if (d.kind === "fixed") return `${n}: [${d.range.left}:${d.range.right}] ${d.packed ? "packed" : "unpacked"}`;
    if (d.kind === "queue") return `${n}: [$] queue`;
    return `${n}: [int] associative`;
  };
  const packedChip = (k: number) => {
    const d = target.dims[k];
    return d.kind === "fixed" && d.packed ? `[${d.range.left}:${d.range.right}]` : "";
  };
  const last = target.dims.length - 1;
  const content = (k: number): React.ReactNode => {
    const d = target.dims[k];
    if (d.kind === "fixed" && d.packed) return <span className={chip}>{packedChip(k)} 32 bits</span>;
    if (d.kind === "fixed") {
      return (
        <div className="flex flex-wrap gap-1">
          {rangeIndices(d.range).map((i) => (
            <span key={i} className={chip}>
              [{i}]
            </span>
          ))}
        </div>
      );
    }
    if (d.kind === "queue") {
      if (d.size === null) return <span className="text-xs text-muted-foreground">varies per key: see the rows</span>;
      if (d.size === 0) return <span className={cn(chip, "border-dashed")}>empty</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: d.size }, (_, i) => (
            <span key={i} className={chip}>
              [{i}]{target.values ? ` ${target.values[i]}` : ""}
            </span>
          ))}
        </div>
      );
    }
    const keys = d.keys ?? [];
    if (!keys.length) return <span className={cn(chip, "border-dashed")}>no keys</span>;
    return (
      <ul className="space-y-1 text-[11px]">
        <li className="text-muted-foreground">⋮ (no smaller keys)</li>
        {keys.map((key, n) => (
          <React.Fragment key={key}>
            {n > 0 && key - keys[n - 1] > 1 ? <li className="text-muted-foreground">⋮ (gap: no keys {keys[n - 1] + 1} to {key - 1})</li> : null}
            <li className="flex flex-wrap items-center gap-1">
              <span className={cn(chip, "border-violet-500/60 bg-violet-500/10")}>key {key}</span>
              {target.rows ? (
                <>
                  <span aria-hidden>→</span>
                  {Array.from({ length: target.rows.find((r) => r.key === key)?.length ?? 0 }, (_, i) => (
                    <span key={i} className={cn(chip, dimension === 2 && "border-cyan-500")}>
                      [{i}] {packedChip(last)}
                    </span>
                  ))}
                </>
              ) : null}
            </li>
          </React.Fragment>
        ))}
        <li className="text-muted-foreground">⋮ (any other int key may be added)</li>
      </ul>
    );
  };
  return (
    <div role="group" aria-label={`${target.declText}: dimensions as nested columns, dimension 1 first`} className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {target.dims.map((_, k) => (target.rows && k === 1 ? (
        <DimColumn key={k} title={dimTitle(k)} active={dimension === k + 1}>
          <span className="text-xs text-muted-foreground">ragged rows: {target.rows.map((r) => `key ${r.key} holds ${r.length}`).join(", ")}</span>
        </DimColumn>
      ) : (
        <DimColumn key={k} title={dimTitle(k)} active={dimension === k + 1}>
          {content(k)}
        </DimColumn>
      )))}
    </div>
  );
}

type Grade = "right" | "wrong" | "blank" | "unreadable";

function gradeAnswer(text: string, answer: QueryValue): Grade {
  if (text.trim() === "") return "blank";
  const v = parseQueryAnswer(text);
  if (v === null) return "unreadable";
  return v === answer ? "right" : "wrong";
}

const gradeText: Record<Grade, string> = { right: "✓ right", wrong: "✕ not this", blank: "no prediction", unreadable: "✕ not a number, 'x or error" };

function QueryMode({ initialTarget, initialDimension }: { initialTarget: string; initialDimension: number }) {
  const [targetId, setTargetId] = useState(initialTarget);
  const target = findQueryTarget(targetId) ?? QUERY_TARGETS[0];
  const [dimension, setDimension] = useState(initialDimension);
  const dim = Math.min(Math.max(dimension, 1), target.dims.length + 1);
  const [answers, setAnswers] = useState<Partial<Record<QueryFunction, string>>>({});
  const [revealed, setRevealed] = useState(false);
  const formId = useId();
  const result = useMemo(() => queryArray(target, dim), [target, dim]);
  const summaryRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  // Where focus goes after the buttons that held it unmount: set only by those buttons.
  const focusAfter = useRef<"summary" | "first-input" | null>(null);

  useEffect(() => {
    const where = focusAfter.current;
    focusAfter.current = null;
    if (where === "summary" && revealed) summaryRef.current?.focus();
    if (where === "first-input" && !revealed) firstInputRef.current?.focus();
  }, [revealed]);

  const reset = () => {
    setAnswers({});
    setRevealed(false);
  };
  const reveal = () => {
    focusAfter.current = "summary";
    setRevealed(true);
  };

  const grades = QUERY_FUNCTIONS.map((fn) => gradeAnswer(answers[fn] ?? "", result.values[fn]));
  const tried = grades.filter((g) => g !== "blank").length;
  const right = grades.filter((g) => g === "right").length;

  return (
    <div className="space-y-4">
      <SegmentedControl
        label="Array"
        mono
        value={target.id}
        onChange={(v) => {
          setTargetId(v);
          setDimension(1);
          reset();
        }}
        options={QUERY_TARGETS.map((t) => ({ value: t.id, label: t.declText }))}
      />
      <SegmentedControl
        label="Dimension number"
        value={String(dim)}
        onChange={(v) => {
          setDimension(Number(v));
          reset();
        }}
        options={Array.from({ length: target.dims.length + 1 }, (_, k) => ({
          value: String(k + 1),
          label: k === target.dims.length ? `${k + 1} (beyond the last)` : `dimension ${k + 1}`,
        }))}
      />
      <Given lines={[`${target.declText};`, `holds: ${target.contents}`]} />
      <QueryLayout target={target} dimension={dim} />
      <form
        aria-labelledby={`${formId}-legend`}
        className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3 sm:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          reveal();
        }}
      >
        <p id={`${formId}-legend`} className="mb-2 text-sm font-semibold text-foreground">
          <span className="mr-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Predict</span>
          Type what each call returns: a number, {code("'x")}, or {code("error")}.
        </p>
        <ul className="space-y-2">
          {QUERY_FUNCTIONS.map((fn, k) => {
            const call = callText(fn, target, dim);
            const g = grades[k];
            return (
              <li key={fn} className="grid gap-1 rounded-lg border border-border/60 bg-background/50 p-2 sm:grid-cols-[minmax(0,16rem)_7rem_1fr] sm:items-center">
                <label htmlFor={`${formId}-${fn}`} className="min-w-0 break-words font-mono text-xs [font-variant-ligatures:none]">
                  {call}
                </label>
                <input
                  ref={k === 0 ? firstInputRef : undefined}
                  id={`${formId}-${fn}`}
                  value={answers[fn] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [fn]: e.target.value }))}
                  disabled={revealed}
                  inputMode="text"
                  autoComplete="off"
                  aria-label={`Your prediction for ${call}`}
                  className="h-9 w-28 rounded-md border border-border/70 bg-background px-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {revealed ? (
                  <div className="text-xs" data-testid={`query-answer-${fn}`}>
                    <span className={cn("font-semibold", g === "right" ? "text-emerald-700 dark:text-emerald-300" : g === "blank" ? "text-muted-foreground" : "text-rose-700 dark:text-rose-300")}>
                      {gradeText[g]}
                    </span>{" "}
                    <span className="font-mono font-semibold [font-variant-ligatures:none]">= {queryValueText(result.values[fn])}</span>
                    <span className="block text-muted-foreground">{result.why[fn]}</span>
                  </div>
                ) : (
                  <span aria-hidden />
                )}
              </li>
            );
          })}
        </ul>
        {!revealed ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={tried === 0}
              className="inline-flex h-10 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >
              Check my predictions
            </button>
            <button type="button" onClick={reveal} className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Reveal without predicting
            </button>
          </div>
        ) : (
          <div ref={summaryRef} tabIndex={-1} aria-label="Results" data-testid="query-results" className="mt-3 space-y-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {tried ? (
              <p className="font-semibold">
                {right} of {tried} predictions right.
              </p>
            ) : null}
            <p className={cn(result.status === "illegal" ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground")} data-testid="query-summary">
              {result.status === "illegal" ? <span aria-hidden>✕ </span> : null}
              {result.summary}
            </p>
            <button
              type="button"
              onClick={() => {
                focusAfter.current = "first-input";
                reset();
              }}
              className="inline-flex min-h-9 items-center rounded-lg border border-border/70 px-3 text-xs text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            >
              Predict again
            </button>
          </div>
        )}
      </form>
      <p className="text-xs text-muted-foreground">
        {PER_DIMENSION.length} functions describe the chosen dimension; {code("$dimensions")} and {code("$unpacked_dimensions")} describe the whole array (§20.7).
      </p>
      <p className="sr-only" aria-live="polite" data-testid="array-select-live">
        {revealed ? `${result.summary} ${QUERY_FUNCTIONS.map((fn) => `${callText(fn, target, dim)} = ${queryValueText(result.values[fn])}`).join("; ")}.` : `Predict the query functions for ${target.expr}, dimension ${dim}.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* shell                                                               */
/* ------------------------------------------------------------------ */

const FRAME: Record<ExplorerMode, { label: string; title: string; summary: string }> = {
  select: {
    label: "Array select explorer: what a select reads",
    title: "Which cells does a select read?",
    summary: "Pick a select, predict its value and kind, then see the cells it reads. Unpacked indices come first, then packed; the rightmost varies fastest (§7.4.4).",
  },
  "part-select": {
    label: "Array select explorer: indexed part-selects",
    title: "Where does +: or -: land?",
    summary: "Predict the bits an indexed part-select reads on a descending and on an ascending declaration (§11.5.1).",
  },
  query: {
    label: "Array select explorer: array query functions",
    title: "What do the query functions return?",
    summary: "Pick an array and a dimension number, predict all eight functions, then check (§20.7, §20.7.1).",
  },
};

export interface ArraySelectExplorerProps {
  mode?: ExplorerMode;
  /** A preset id from ARRAY_SELECT_PRESETS for this mode. */
  preset?: string;
  className?: string;
}

export default function ArraySelectExplorer({ mode = "select", preset, className }: ArraySelectExplorerProps) {
  const m: ExplorerMode = mode === "part-select" || mode === "query" ? mode : "select";
  const { preset: p, unknown } = resolvePreset(m, preset);
  const frame = FRAME[m];
  return (
    <VisualFrame label={frame.label} eyebrow="Experiment" title={frame.title} summary={frame.summary} fidelity="model" assumptions={ARRAY_SELECT_ASSUMPTIONS} className={className}>
      {unknown ? (
        <p role="note" className="text-xs text-rose-700 dark:text-rose-300">
          Preset “{preset}” is not one of {ARRAY_SELECT_PRESETS.filter((x) => x.mode === m).map((x) => x.id).join(", ")}; showing {p.id}.
        </p>
      ) : null}
      {m === "select" ? <SelectMode key={p.id} initialCase={p.caseId ?? "w2"} /> : null}
      {m === "part-select" ? <PartMode key={p.id} initialCase={p.partCaseId ?? "v-var"} initialSlider={p.slider ?? 0} /> : null}
      {m === "query" ? <QueryMode key={p.id} initialTarget={p.targetId ?? "f"} initialDimension={p.dimension ?? 1} /> : null}
    </VisualFrame>
  );
}
