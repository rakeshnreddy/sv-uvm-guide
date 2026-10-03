"use client";

import React, { useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { CycleWaveform, type CycleMarker } from "@/components/visual-system/CycleWaveform";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  classifyValue,
  covergroupToSource,
  describeValues,
  elaborateCovergroup,
  formatTransition,
  generateStimulus,
  isIdentifier,
  normaliseWildcard,
  parseRangeListText,
  parseTransitionText,
  runCoverage,
  samplesFromClockedTrace,
  type BinDecl,
  type BinKeyword,
  type CovergroupSpec,
  type ElaboratedCoverpoint,
  type ResolvedBin,
  type SamplingMode,
} from "@/lib/coverage-model";
import { cn } from "@/lib/utils";

const WIDTH = 4;
const MAX = 15;
const VALUES = Array.from({ length: MAX + 1 }, (_, i) => i);

const BUILDER_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §19.5: explicit, array [] and fixed-count [N] bins (§19.5.1), transitions with => , [* n] and [-> n] (§19.5.2), automatic bins (§19.5.3), wildcard bins (§19.5.4), default, ignore_bins (§19.5.5) and illegal_bins (§19.5.6).",
  "Coverpoint coverage is covered bins / counted bins (§19.11.1). Default, ignore and illegal bins and bins left empty after exclusions are not counted.",
  "2-state values only (bit [3:0] data). Nonconsecutive [= n] and default sequence are not modelled.",
  "An illegal_bins hit is a run-time error. The model keeps sampling; a real simulator may stop if its error limit is reached.",
];

// ---------------------------------------------------------------------------
// Editor rows → bin declarations
// ---------------------------------------------------------------------------

type RowKind = BinKeyword | "default";
type RowForm = "values" | "open" | "fixed" | "wildcard" | "wildcard-open" | "transition" | "transition-open";

interface EditorRow {
  id: string;
  kind: RowKind;
  name: string;
  form: RowForm;
  count: number;
  text: string;
}

const formLabels: Record<RowForm, string> = {
  values: "= {values}",
  open: "[] = {values}",
  fixed: "[N] = {values}",
  wildcard: "wildcard = {pattern}",
  "wildcard-open": "wildcard [] = {pattern}",
  transition: "= (transitions)",
  "transition-open": "[] = (transitions)",
};

function rowToDecl(row: EditorRow): { decl?: BinDecl; error?: string } {
  if (!isIdentifier(row.name)) return { error: "Bin names must be identifiers (letters, digits, _)." };
  if (row.kind === "default") return { decl: { form: "default", name: row.name } };
  const keyword = row.kind;
  if (row.form === "values" || row.form === "open" || row.form === "fixed") {
    const parsed = parseRangeListText(row.text, MAX);
    if (!parsed.ok) return { error: parsed.error };
    const array = row.form === "open" ? "open" : row.form === "fixed" ? Math.max(1, Math.floor(row.count) || 1) : undefined;
    return { decl: { form: "values", keyword, name: row.name, array, values: parsed.value } };
  }
  if (row.form === "wildcard" || row.form === "wildcard-open") {
    const pattern = row.text.trim().replace(/^\{/, "").replace(/\}$/, "").trim();
    const { error } = normaliseWildcard(pattern, WIDTH);
    if (error) return { error: `Write a ${WIDTH}-bit pattern such as 4'b11?? (${error}).` };
    return { decl: { form: "wildcard", keyword, name: row.name, array: row.form === "wildcard-open" ? "open" : undefined, pattern } };
  }
  const parsed = parseTransitionText(row.text, MAX);
  if (!parsed.ok) return { error: parsed.error };
  return { decl: { form: "transition", keyword, name: row.name, array: row.form === "transition-open" ? "open" : undefined, sequences: parsed.value } };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

type BuilderPresetId = "exclusions" | "explicit" | "arrays" | "auto" | "wildcard" | "transitions";

interface Probe {
  history: number[];
  value: number;
}

interface BuilderPreset {
  label: string;
  summary: string;
  rows: Omit<EditorRow, "id">[];
  autoBinMax?: number;
  probe: Probe;
}

const row = (kind: RowKind, name: string, form: RowForm, text: string, count = 4): Omit<EditorRow, "id"> => ({ kind, name, form, text, count });

const builderPresets: Record<BuilderPresetId, BuilderPreset> = {
  exclusions: {
    label: "default · ignore · illegal",
    summary: "Two ranges, a default bin, an ignored range and an illegal value that overlaps bin high.",
    rows: [
      row("bins", "low", "values", "[0:3]"),
      row("bins", "high", "values", "[12:15]"),
      row("ignore_bins", "skip", "values", "[4:7]"),
      row("illegal_bins", "bad", "values", "13"),
      row("default", "others", "values", ""),
    ],
    probe: { history: [], value: 13 },
  },
  explicit: {
    label: "explicit ranges",
    summary: "One bin, one array of single-value bins, one more bin. No default bin.",
    rows: [row("bins", "low", "values", "[0:3]"), row("bins", "mid", "open", "[4:7]"), row("bins", "high", "values", "[12:15]")],
    probe: { history: [], value: 9 },
  },
  arrays: {
    label: "[N] fixed arrays",
    summary: "bins q[3] = {[0:9]}: B = floor(10/3) = 3 values per bin, the last bin takes the rest.",
    rows: [row("bins", "q", "fixed", "[0:9]", 3), row("bins", "odd", "open", "11, 13, 15")],
    probe: { history: [], value: 9 },
  },
  auto: {
    label: "automatic bins",
    summary: "No bins declared: SystemVerilog creates min(2^4, auto_bin_max) automatic bins; the last takes the remainder.",
    rows: [],
    autoBinMax: 3,
    probe: { history: [], value: 13 },
  },
  wildcard: {
    label: "wildcard",
    summary: "? matches 0 or 1. A value can land in two overlapping bins at once.",
    rows: [row("bins", "upper", "wildcard", "4'b11??"), row("bins", "even", "wildcard-open", "4'b???0")],
    probe: { history: [], value: 12 },
  },
  transitions: {
    label: "transitions",
    summary: "Transition bins count sequences of samples: => means the next sample, [* n] consecutive repeats, [-> n] repeats with gaps.",
    rows: [row("bins", "rise", "transition", "(0 => 1 => 2)"), row("bins", "hold", "transition", "(5 [* 3])"), row("bins", "wrap", "transition", "(15 => 0)")],
    probe: { history: [15], value: 0 },
  },
};

let rowSeq = 0;
const withIds = (rows: Omit<EditorRow, "id">[]): EditorRow[] => rows.map((r) => ({ ...r, id: `r${(rowSeq += 1)}` }));

function builderSpec(decls: BinDecl[], autoBinMax: number | undefined, atLeast: number): CovergroupSpec {
  return {
    name: "cg_data",
    event: { kind: "sample", args: "bit [3:0] data" },
    atLeast: atLeast === 1 ? undefined : atLeast,
    coverpoints: [{ name: "cp_data", expr: "data", width: WIDTH, autoBinMax, bins: decls }],
  };
}

// ---------------------------------------------------------------------------
// Prediction options from the model
// ---------------------------------------------------------------------------

interface ProbeAnswer {
  kind: "error" | "hit" | "default" | "ignored" | "none";
  bins: string[];
  why: string;
}

function evaluateProbe(spec: CovergroupSpec, probe: Probe): ProbeAnswer {
  const model = elaborateCovergroup(spec);
  const cp = model.coverpoints[0];
  const { records } = runCoverage(
    model,
    [...probe.history, probe.value].map((v) => ({ values: { data: v } })),
  );
  const last = records[records.length - 1];
  const bins = cp.bins.filter((b) => last.hits.includes(b.key));
  const counted = bins.filter((b) => b.counted && (b.kind === "bins" || b.kind === "auto"));
  const state = classifyValue(cp, probe.value);
  const transitionHits = counted.filter((b) => b.transition);
  if (last.errors.length > 0) {
    return { kind: "error", bins: [last.errors[0].bin], why: state.outcome === "illegal" ? state.why : `The illegal transition ${last.errors[0].bin} completes on this sample: a run-time error.` };
  }
  if (counted.length > 0) {
    const why =
      transitionHits.length > 0
        ? `${transitionHits.map((b) => b.name).join(" and ")} completes on this sample: ${transitionHits.map((b) => b.sequences.map((s) => formatTransition(s)).join(" or ")).join("; ")}.${state.outcome === "hit" ? ` ${state.why}` : ""}`
        : state.why;
    return { kind: "hit", bins: counted.map((b) => b.name), why };
  }
  if (state.outcome === "default") return { kind: "default", bins: [state.defaultBin?.name ?? "default"], why: state.why };
  if (state.outcome === "ignored") return { kind: "ignored", bins: [state.ignored[0]?.name ?? ""], why: state.why };
  return { kind: "none", bins: [], why: cp.bins.some((b) => b.transition) ? `No state bin lists ${probe.value} and no transition completes on this sample, so nothing counts it.` : state.why };
}

function probeOptions(spec: CovergroupSpec, probe: Probe): PredictionOption[] {
  const model = elaborateCovergroup(spec);
  const cp = model.coverpoints[0];
  const answer = evaluateProbe(spec, probe);
  const state = classifyValue(cp, probe.value);
  const v = probe.value;
  const hasDefault = cp.bins.some((b) => b.kind === "default");
  const options: PredictionOption[] = [];
  const correctLabel =
    answer.kind === "error"
      ? `A run-time error from illegal_bins ${answer.bins[0]}; no bin counts it`
      : answer.kind === "hit"
        ? answer.bins.length > 1
          ? `Both ${answer.bins.join(" and ")}`
          : `Bin ${answer.bins[0]}`
        : answer.kind === "default"
          ? `The default bin ${answer.bins[0]} (never counted toward coverage)`
          : answer.kind === "ignored"
            ? `Nothing counts it: ignore_bins ${answer.bins[0]}`
            : "No bin: the sample is not counted";
  options.push({ id: "correct", label: correctLabel, correct: true, feedback: answer.why });

  const valuesOf = (b: ResolvedBin) => (b.transition ? b.sequences.map((s) => `(${formatTransition(s)})`).join(", ") : `{${describeValues(b.declaredValues)}}`);
  const candidates = cp.bins.filter((b) => (b.kind === "bins" || b.kind === "auto") && !answer.bins.includes(b.name));
  const shadowed = candidates.filter((b) => state.shadowed.includes(b));
  const others = candidates.filter((b) => !state.shadowed.includes(b));
  for (const b of [...shadowed, ...others].slice(0, answer.kind === "hit" && answer.bins.length > 1 ? 1 : 2)) {
    const feedback = state.shadowed.includes(b)
      ? `${b.name} lists ${v}, but ${state.illegal.length > 0 ? "illegal_bins" : "ignore_bins"} also lists it. Excluded values are removed from every bin after the bins are built (§19.5.5, §19.5.6).`
      : b.transition
        ? `${b.name} counts the sequence ${valuesOf(b)}; the samples so far do not complete it.`
        : `${b.name} holds ${valuesOf(b)}; ${v} is not one of them.`;
    options.push({ id: `bin-${b.name}`, label: `Bin ${b.name}`, correct: false, feedback });
  }
  if (answer.kind === "hit" && answer.bins.length > 1) {
    options.push({ id: "only-first", label: `Only ${answer.bins[0]}`, correct: false, feedback: `${answer.bins[0]} does increment, but so does ${answer.bins.slice(1).join(" and ")}. Overlapping bins each count the same sample.` });
  }
  if (answer.kind !== "none") {
    options.push({
      id: "none",
      label: "No bin: the sample is not counted",
      correct: false,
      feedback:
        answer.kind === "error"
          ? "Stronger than that: an illegal value is not just uncounted, the simulator also reports a run-time error."
          : answer.kind === "ignored"
            ? "Close: nothing counts it, but because ignore_bins names it, not because it falls outside every bin."
            : `${v} does land somewhere: ${answer.why}`,
    });
  }
  if (!hasDefault && answer.kind !== "default") {
    options.push({
      id: "implicit-default",
      label: "An implicit default bin catches it",
      correct: false,
      feedback: "There is no implicit default bin. Without bins others = default, a value outside every bin is simply not counted (§19.5).",
    });
  }
  if (answer.kind === "error") {
    options.push({
      id: "fatal",
      label: "The simulation terminates immediately",
      correct: false,
      feedback: "The LRM only requires a run-time error (§19.5.6). Whether the run stops depends on the tool's error-limit settings.",
    });
  }
  return options.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Bins tab
// ---------------------------------------------------------------------------

const kindBadge: Record<string, { glyph: string; className: string; label: string }> = {
  bins: { glyph: "●", className: "border-cyan-500/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200", label: "bins" },
  auto: { glyph: "●", className: "border-cyan-500/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200", label: "auto" },
  default: { glyph: "◌", className: "border-dashed border-slate-400/70 text-slate-700 dark:text-slate-300", label: "default" },
  ignore: { glyph: "⊘", className: "border-slate-400/60 bg-slate-500/10 text-slate-700 dark:text-slate-300", label: "ignore_bins" },
  illegal: { glyph: "✕", className: "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300", label: "illegal_bins" },
};

function valueCell(cp: ElaboratedCoverpoint, v: number) {
  const c = classifyValue(cp, v);
  if (c.outcome === "illegal") return { glyph: "✕", text: c.illegal[0].name, className: kindBadge.illegal.className, state: `illegal_bins ${c.illegal[0].name}: run-time error` };
  if (c.outcome === "ignored") return { glyph: "⊘", text: c.ignored[0].name, className: kindBadge.ignore.className, state: `ignore_bins ${c.ignored[0].name}: not counted` };
  if (c.outcome === "hit") return { glyph: "●", text: c.hits.map((b) => b.name).join(" + "), className: kindBadge.bins.className, state: `counted in ${c.hits.map((b) => b.name).join(" and ")}` };
  if (c.outcome === "default") return { glyph: "◌", text: c.defaultBin?.name ?? "default", className: kindBadge.default.className, state: `default bin ${c.defaultBin?.name}: not counted toward coverage` };
  return { glyph: "—", text: "no bin", className: "border-border/60 text-muted-foreground", state: "in no bin: not counted" };
}

const selectClass = "h-9 rounded-md border border-border/70 bg-background/60 px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const inputClass = "h-9 rounded-md border border-border/70 bg-background/60 px-2 font-mono text-xs text-foreground [font-variant-ligatures:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const smallButton =
  "inline-flex h-9 items-center rounded-lg border border-border/70 px-3 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";

function BinsTab({ initialPreset }: { initialPreset: BuilderPresetId }) {
  const [presetId, setPresetId] = useState<BuilderPresetId>(initialPreset);
  const [rows, setRows] = useState<EditorRow[]>(() => withIds(builderPresets[initialPreset].rows));
  const [autoBinMax, setAutoBinMax] = useState<number | undefined>(builderPresets[initialPreset].autoBinMax);
  const [atLeast, setAtLeast] = useState(1);
  const [probeValue, setProbeValue] = useState(builderPresets[initialPreset].probe.value);
  const [history, setHistory] = useState<number[]>([]);
  const [randomRuns, setRandomRuns] = useState(0);

  const preset = builderPresets[presetId];
  const parsed = rows.map((r) => ({ row: r, ...rowToDecl(r) }));
  const names = parsed.map((p) => p.row.name);
  const decls = parsed.filter((p, i) => p.decl && names.indexOf(p.row.name) === i).map((p) => p.decl as BinDecl);
  const declKey = JSON.stringify(decls);
  const spec = useMemo(() => builderSpec(JSON.parse(declKey) as BinDecl[], autoBinMax, atLeast), [declKey, autoBinMax, atLeast]);
  const model = useMemo(() => elaborateCovergroup(spec), [spec]);
  const cp = model.coverpoints[0];
  const probe: Probe = { history: preset.probe.history, value: probeValue };
  const probeKey = JSON.stringify({ declKey, autoBinMax, probe });

  const result = useMemo(() => runCoverage(model, history.map((v) => ({ values: { data: v } }))), [model, history]);
  const item = result.final.items[0];
  const lastRecord = result.records[result.records.length - 1];
  const lastHit = lastRecord ? cp.bins.find((b) => lastRecord.hits.includes(b.key)) : undefined;

  const lines: CodeTraceLine[] = covergroupToSource(spec).map((text) => {
    const m = /^\s*(?:wildcard )?(?:bins|ignore_bins|illegal_bins) (\w+)/.exec(text);
    return { text, key: m ? `bin:${m[1]}` : undefined };
  });

  const loadPreset = (id: BuilderPresetId) => {
    setPresetId(id);
    setRows(withIds(builderPresets[id].rows));
    setAutoBinMax(builderPresets[id].autoBinMax);
    setProbeValue(builderPresets[id].probe.value);
    setHistory([]);
  };
  const updateRow = (id: string, patch: Partial<EditorRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = (kind: RowKind) => {
    const n = rows.length + 1;
    const base =
      kind === "bins" ? row("bins", `b${n}`, "values", "[8:11]") : kind === "ignore_bins" ? row("ignore_bins", `skip${n}`, "values", "8") : kind === "illegal_bins" ? row("illegal_bins", `bad${n}`, "values", "15") : row("default", "others", "values", "");
    setRows((rs) => [...rs, ...withIds([base])]);
  };
  const sample = (values: number[]) => setHistory((h) => [...h, ...values].slice(-200));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <SegmentedControl label="Bins preset" value={presetId} onChange={loadPreset} options={(Object.keys(builderPresets) as BuilderPresetId[]).map((id) => ({ value: id, label: builderPresets[id].label }))} />
        <p className="text-xs text-muted-foreground">{preset.summary}</p>
      </div>

      <fieldset className="space-y-2 rounded-xl border border-border/70 p-3">
        <legend className="px-1 text-xs font-semibold text-foreground">
          Bins of <code className="font-mono [font-variant-ligatures:none]">cp_data: coverpoint data</code> (bit [3:0])
        </legend>
        {rows.length === 0 ? <p className="text-xs text-muted-foreground">No bins declared, so SystemVerilog creates automatic bins (§19.5.3).</p> : null}
        <ul className="space-y-2">
          {parsed.map(({ row: r, error }, i) => {
            const duplicate = names.indexOf(r.name) !== i;
            const message = error ?? (duplicate ? `"${r.name}" is already used in this coverpoint.` : undefined);
            const errId = `${r.id}-err`;
            return (
              <li key={r.id} className="space-y-1">
                <div className="space-y-1.5 rounded-lg border border-border/60 p-2">
                  <div className="flex items-center gap-1.5">
                    <select aria-label={`Bin ${i + 1} keyword`} value={r.kind} onChange={(e) => updateRow(r.id, { kind: e.target.value as RowKind })} className={cn(selectClass, "font-mono [font-variant-ligatures:none]")}>
                      <option value="bins">bins</option>
                      <option value="ignore_bins">ignore_bins</option>
                      <option value="illegal_bins">illegal_bins</option>
                      <option value="default">bins … = default</option>
                    </select>
                    <input aria-label={`Bin ${i + 1} name`} value={r.name} onChange={(e) => updateRow(r.id, { name: e.target.value })} className={cn(inputClass, "min-w-0 flex-1")} aria-invalid={Boolean(message)} aria-describedby={message ? errId : undefined} />
                    <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} aria-label={`Remove bin ${r.name}`} className={cn(smallButton, "px-2")}>
                      ✕
                    </button>
                  </div>
                  {r.kind !== "default" ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select aria-label={`Bin ${i + 1} form`} value={r.form} onChange={(e) => updateRow(r.id, { form: e.target.value as RowForm })} className={cn(selectClass, "max-w-full font-mono [font-variant-ligatures:none]")}>
                        {(Object.keys(formLabels) as RowForm[]).map((f) => (
                          <option key={f} value={f}>
                            {formLabels[f]}
                          </option>
                        ))}
                      </select>
                      {r.form === "fixed" ? (
                        <input aria-label={`Bin ${i + 1} count N`} type="number" min={1} max={16} value={r.count} onChange={(e) => updateRow(r.id, { count: Number(e.target.value) })} className={cn(inputClass, "w-14")} />
                      ) : null}
                      <input
                        aria-label={`Bin ${i + 1} values`}
                        value={r.text}
                        onChange={(e) => updateRow(r.id, { text: e.target.value })}
                        className={cn(inputClass, "min-w-[7rem] flex-1")}
                        aria-invalid={Boolean(message)}
                        aria-describedby={message ? errId : undefined}
                      />
                    </div>
                  ) : (
                    <p className="font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">bins {r.name} = default; catches every value no other bin lists</p>
                  )}
                </div>
                {message ? (
                  <p id={errId} className="text-xs text-rose-700 dark:text-rose-300">
                    {message} This row is left out of the covergroup.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          {(["bins", "ignore_bins", "illegal_bins"] as RowKind[]).map((k) => (
            <button key={k} type="button" onClick={() => addRow(k)} className={cn(smallButton, "font-mono [font-variant-ligatures:none]")}>
              + {k}
            </button>
          ))}
          <button type="button" onClick={() => addRow("default")} disabled={rows.some((r) => r.kind === "default")} className={cn(smallButton, "font-mono [font-variant-ligatures:none]")}>
            + default
          </button>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <code className="font-mono [font-variant-ligatures:none]">option.auto_bin_max</code>
            <select
              value={autoBinMax ?? 64}
              onChange={(e) => setAutoBinMax(Number(e.target.value) === 64 ? undefined : Number(e.target.value))}
              className={selectClass}
            >
              {[2, 3, 4, 8, 64].map((n) => (
                <option key={n} value={n}>
                  {n === 64 ? "64 (default)" : n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <code className="font-mono [font-variant-ligatures:none]">option.at_least</code>
            <select value={atLeast} onChange={(e) => setAtLeast(Number(e.target.value))} className={selectClass}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {model.diagnostics.length > 0 ? (
          <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-200">
            {model.diagnostics.map((d) => (
              <li key={d}>⚠ {d}</li>
            ))}
          </ul>
        ) : null}
      </fieldset>

      <PredictionPrompt
        resetKey={probeKey}
        question={
          probe.history.length > 0
            ? `After sampling ${probe.history.join(", ")}, the next call is cg.sample(${probe.value}). What counts it?`
            : `cg.sample(${probe.value}) is called. Which bin does the value ${probe.value} land in?`
        }
        options={probeOptions(spec, probe)}
      >
        <p className="text-sm text-muted-foreground">Check it on the value map below: the cell for {probe.value} shows where it lands. Try another value next.</p>
      </PredictionPrompt>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Ask about another value
        <select value={probeValue} onChange={(e) => setProbeValue(Number(e.target.value))} className={selectClass}>
          {VALUES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Value map: press a value to call cg.sample(value)</p>
        <div className="grid gap-1.5 grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))]">
          {VALUES.map((v) => {
            const cell = valueCell(cp, v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => sample([v])}
                aria-label={`Sample ${v}: ${cell.state}`}
                className={cn(
                  "flex min-h-12 min-w-0 flex-col items-center justify-center rounded-lg border px-1 py-1 text-xs transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                  cell.className,
                  v === probe.value && "ring-2 ring-amber-400",
                )}
              >
                <span className="font-mono text-sm font-semibold">{v}</span>
                <span aria-hidden className="max-w-full truncate font-mono text-[10px] [font-variant-ligatures:none]">
                  {cell.glyph} {cell.text}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">● counted bin · ◌ default bin (not counted) · ⊘ ignore_bins · ✕ illegal_bins (run-time error) · — no bin (not counted)</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={smallButton}
            onClick={() => {
              const next = randomRuns + 1;
              setRandomRuns(next);
              sample(generateStimulus({ vars: [{ name: "data", width: WIDTH }] }, 8, next).map((s) => s.values.data));
            }}
          >
            Sample 8 random values
          </button>
          <button type="button" className={smallButton} onClick={() => setHistory([])} disabled={history.length === 0}>
            Reset samples
          </button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <div className="min-w-0">
          <CodeTrace label="Generated covergroup" lines={lines} activeKey={lastHit ? `bin:${lastHit.declName}` : undefined} />
        </div>
        <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3 text-sm">
          <div aria-live="polite">
            <p className="font-mono text-[12px] font-semibold text-foreground [font-variant-ligatures:none]">
              cp_data: {item.covered} / {item.total} counted bins = {item.excluded ? "excluded (no countable bins)" : `${Math.round(item.percent * 10) / 10}%`}
            </p>
            {lastRecord ? (
              <p className={cn("mt-1 text-xs", lastRecord.errors.length > 0 ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground")}>
                {lastRecord.errors.length > 0 ? `✕ Error: ${lastRecord.errors[0].message}. ` : ""}
                Last sample {lastRecord.values.data}: {evaluateProbe(spec, { history: history.slice(0, -1), value: lastRecord.values.data }).why}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">No samples yet. Every counted bin is a hole.</p>
            )}
          </div>
          <ul className="space-y-1">
            {item.bins.map((b) => {
              const bin = cp.bins.find((x) => x.key === b.key) as ResolvedBin;
              const badge = kindBadge[bin.kind];
              const status = !b.counted
                ? bin.kind === "bins" || bin.kind === "auto"
                  ? `excluded: ${bin.excludedReason}`
                  : bin.kind === "default"
                    ? "not counted, not crossed"
                    : bin.kind === "illegal"
                      ? `${b.hits} error${b.hits === 1 ? "" : "s"}`
                      : "not counted"
                : b.covered
                  ? `✓ covered (${b.hits})`
                  : `○ hole (${b.hits}/${item.atLeast})`;
              return (
                <li key={b.key} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className={cn("rounded border px-1 font-mono text-[10px] [font-variant-ligatures:none]", badge.className)}>
                    {badge.glyph} {badge.label}
                  </span>
                  <span className="font-mono text-foreground [font-variant-ligatures:none]">{b.name}</span>
                  <span className="font-mono text-muted-foreground [font-variant-ligatures:none]">
                    {bin.transition ? bin.sequences.map((s) => `(${formatTransition(s)})`).join(", ") : bin.kind === "default" ? "everything else" : `{${describeValues(bin.values.length > 0 ? bin.values : bin.declaredValues)}}`}
                  </span>
                  <span className={cn("ml-auto", b.covered ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>{status}</span>
                </li>
              );
            })}
          </ul>
          {history.length > 0 ? (
            <p className="font-mono text-[11px] text-muted-foreground [font-variant-ligatures:none]">
              samples: {history.slice(-24).join(", ")}
              {history.length > 24 ? " …" : ""}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sampling tab (§19.3): when does a covergroup sample?
// ---------------------------------------------------------------------------

type SamplingId = "iff" | "no-iff" | "double" | "monitor";

const TRACE = { valid: [0, 1, 0, 1, 0, 0, 1, 0], addr: [13, 12, 14, 2, 15, 13, 0, 12] };
const EDGES = 8;

const samplingModes: Record<SamplingId, { label: string; mode: SamplingMode; iff: boolean; event: CovergroupSpec["event"]; extra: string[]; why: string }> = {
  iff: {
    label: "@(posedge clk) iff (valid)",
    mode: "clock",
    iff: true,
    event: { kind: "clock", expr: "posedge clk" },
    extra: [],
    why: "The clocking event samples on every edge, but iff (valid) makes idle edges count nowhere. Only the transfer at edge 1 lands in high.",
  },
  "no-iff": {
    label: "@(posedge clk), no iff",
    mode: "clock",
    iff: false,
    event: { kind: "clock", expr: "posedge clk" },
    extra: [],
    why: "Without a guard, every edge counts, including idle cycles where addr holds leftover values. Idle traffic inflates high and fakes closure.",
  },
  double: {
    label: "@(posedge clk) + sample()",
    mode: "clock+sample",
    iff: true,
    event: { kind: "clock", expr: "posedge clk" },
    extra: ["", "// monitor, on the same edge:", "@(posedge clk) if (valid) cov.sample();"],
    why: "A clocking event samples as if the triggering process called sample() (§19.3). The extra sample() counts every valid edge a second time.",
  },
  monitor: {
    label: "with function sample(), from a monitor",
    mode: "sample-on-valid",
    iff: false,
    event: { kind: "sample", args: "bit [3:0] addr" },
    extra: ["", "// monitor: one call per observed transfer", "@(vif.mon_cb) if (vif.mon_cb.valid) cov.sample(vif.mon_cb.addr);"],
    why: "No clocking event: the monitor calls sample() once per valid transfer, with the value it read through a clocking block. One transfer, one count.",
  },
};

function samplingSpec(id: SamplingId): CovergroupSpec {
  const m = samplingModes[id];
  return {
    name: "cg_addr",
    event: m.event,
    atLeast: 2,
    coverpoints: [
      {
        name: "cp_addr",
        expr: "addr",
        width: WIDTH,
        iff: m.iff ? "valid" : undefined,
        bins: [
          { form: "values", keyword: "bins", name: "low", values: [[0, 3]] },
          { form: "values", keyword: "bins", name: "high", values: [[12, 15]] },
        ],
      },
    ],
  };
}

function samplingRun(id: SamplingId) {
  const spec = samplingSpec(id);
  const samples = samplesFromClockedTrace(TRACE, EDGES, samplingModes[id].mode);
  const { records, final } = runCoverage(elaborateCovergroup(spec), samples);
  const high = final.items[0].bins.find((b) => b.name === "high")?.hits ?? 0;
  return { spec, records, final, high };
}

function SamplingTab() {
  const [id, setId] = useState<SamplingId>("iff");
  const runs = useMemo(() => Object.fromEntries((Object.keys(samplingModes) as SamplingId[]).map((k) => [k, samplingRun(k)])) as Record<SamplingId, ReturnType<typeof samplingRun>>, []);
  const current = runs[id];
  const item = current.final.items[0];

  const markers: CycleMarker[] = [];
  for (let k = 0; k < EDGES; k += 1) {
    const recs = current.records.filter((r) => r.edge === k);
    if (recs.length === 0) continue;
    const counted = recs.filter((r) => r.outcomes.cp_addr !== "guarded");
    const bins = Array.from(new Set(counted.flatMap((r) => r.hits.map((h) => h.split(".")[1]))));
    markers.push({
      edge: k,
      tone: counted.length === 0 ? "vacuous" : "sample",
      glyph: counted.length === 0 ? "○" : "▼".repeat(recs.length),
      short: counted.length === 0 ? "iff ✕" : `${bins.join("+") || "–"}${recs.length > 1 ? " ×2" : ""}`,
      label: `edge ${k}: ${recs.length} sample${recs.length === 1 ? "" : "s"} (${recs.map((r) => r.source).join(", ")})${counted.length === 0 ? ", guard false: ignored" : bins.length ? `, counted in ${bins.join(" and ")}` : ", in no bin"}`,
    });
  }

  const counts = Array.from(new Set((Object.keys(runs) as SamplingId[]).map((k) => runs[k].high))).sort((a, b) => a - b);
  if (!counts.includes(0)) counts.unshift(0);
  const options: PredictionOption[] = counts.map((c) => {
    const modesWith = (Object.keys(runs) as SamplingId[]).filter((k) => runs[k].high === c);
    return {
      id: `n${c}`,
      label: `${c} time${c === 1 ? "" : "s"}`,
      correct: c === current.high,
      feedback:
        c === current.high
          ? samplingModes[id].why
          : modesWith.length > 0
            ? `That is the count for ${modesWith.map((k) => samplingModes[k].label).join(" and ")}. ${samplingModes[modesWith[0]].why}`
            : "Edge 1 carries a valid transfer with addr = 12, so high counts at least once in every version.",
    };
  });

  const lines: CodeTraceLine[] = [...covergroupToSource(current.spec), ...samplingModes[id].extra].map((text) => ({ text }));

  return (
    <div className="space-y-4">
      <SegmentedControl label="Sampling style" mono value={id} onChange={setId} options={(Object.keys(samplingModes) as SamplingId[]).map((k) => ({ value: k, label: samplingModes[k].label }))} />
      {/* relative + overflow-hidden contains CycleWaveform's screen-reader table, which is wider than 1px at phone widths. */}
      <div className="relative overflow-hidden rounded-xl">
      <CycleWaveform
        title="Bus trace with covergroup samples"
        edges={EDGES}
        cycleWidth={38}
        signals={[
          { name: "clk", kind: "clock" },
          { name: "valid", kind: "bit", values: TRACE.valid },
          { name: "addr", kind: "bus", values: TRACE.addr },
        ]}
        markers={markers}
        caption="x-axis: clock edges 0–7. Each value is the one held just before its edge (driven with <= or a clocking block), which is what the covergroup reads. ▼ = one sample (▼▼ = two on the same edge), ○ = sampled but the iff guard is false."
      />
      </div>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <div className="min-w-0">
          <CodeTrace label="Covergroup and sampling code" lines={lines} />
        </div>
        <PredictionPrompt resetKey={id} question="Over these 8 edges, how many times does bin high increment?" options={options}>
          <div className="space-y-1 text-sm" aria-live="polite">
            <p className="font-mono text-[12px] [font-variant-ligatures:none]">
              {item.bins.map((b) => `${b.name}: ${b.hits} hit${b.hits === 1 ? "" : "s"}${b.covered ? " ✓" : " ○"}`).join(" · ")}
            </p>
            <p className="font-mono text-[12px] [font-variant-ligatures:none]">
              cp_addr: {item.covered} / {item.total} (option.at_least = 2) = {Math.round(item.percent)}%
            </p>
            <p className="text-muted-foreground">
              {id === "no-iff" || id === "double"
                ? "✕ False closure: 100% here does not mean two real transfers reached the high range."
                : "✓ Honest number: only real transfers count, so high still needs a second transfer."}
            </p>
          </div>
        </PredictionPrompt>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface CovergroupBuilderProps {
  /** Which tab opens first. */
  initialTab?: "bins" | "sampling";
  preset?: BuilderPresetId;
}

export const CovergroupBuilder = ({ initialTab = "bins", preset = "exclusions" }: CovergroupBuilderProps) => {
  const [tab, setTab] = useState<"bins" | "sampling">(initialTab);
  return (
    <VisualFrame
      label="Covergroup bins editor"
      eyebrow="Experiment · bins and sampling"
      title={tab === "bins" ? "Where does a sampled value land?" : "When does a covergroup sample?"}
      summary={
        tab === "bins"
          ? "Edit the bins of one coverpoint, predict where a value lands, then sample values and watch the bins fill."
          : "The same 8-cycle bus trace sampled four ways. Predict the count before you look."
      }
      fidelity="model"
      assumptions={BUILDER_ASSUMPTIONS}
    >
      <SegmentedControl
        label="View"
        value={tab}
        onChange={setTab}
        options={[
          { value: "bins", label: "Bins" },
          { value: "sampling", label: "Sampling" },
        ]}
      />
      {tab === "bins" ? <BinsTab initialPreset={preset} /> : <SamplingTab />}
    </VisualFrame>
  );
};
