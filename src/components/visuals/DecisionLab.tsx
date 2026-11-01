"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { classifyValue, comparisonStyles, valueStyles } from "@/components/visual-system/visual-language";
import {
  COMPARE_SETS,
  DECISION_FORMS,
  DECISION_PRESETS,
  FORM_LABELS,
  MATCH_COLUMNS,
  QUALIFIERS,
  REPORT_KINDS,
  WILDCARD_ASYMMETRY_NOTE,
  branchWord,
  catchAllWord,
  compareDecisions,
  decisionSource,
  editedPresetNote,
  evaluateDecision,
  explainReportChoice,
  explainRunChoice,
  findCompareSet,
  findPreset,
  gridCell,
  isIfChain,
  isPlainMiss,
  isPresetEdited,
  itemMissLine,
  itemWord,
  matchColumnLabel,
  reportChoiceLabel,
  runChoiceLabel,
  runChoices,
  runOutcomeId,
  runningLineKey,
  type BitChip,
  type CompareLeftKind,
  type DecisionConfig,
  type DecisionForm,
  type DecisionResult,
  type ItemVerdict,
  type Qualifier,
  type TermVerdict,
} from "@/lib/sv-decision-model";
import { BIT4_VALUES, bitsToString, formatLiteral, hasUnknown, isUnknownBit, parseBits, type Bit4 } from "@/lib/sv-four-state-model";
import { cn } from "@/lib/utils";

export const DECISION_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §12.4–§12.4.2 (if, unique-if, unique0-if, priority-if), §12.5–§12.5.4 (case, casez, casex, the qualifiers, case inside) and §11.4.4, §11.4.6, §11.4.13 (relational, wildcard equality and inside operators).",
  "Matching reuses the four-state model behind the F2A explorer (caseItemMatches and ==?), so the two visuals cannot disagree about a comparison.",
  "The select is unsigned. Items are literals, ranges [lo:hi] and bit-selects. $ bounds, tolerance ranges, strings and side effects in item expressions are not modelled.",
  "A violation is shown as a ticket. A simulator holds the report until the Observed region of the time step and words it in its own way (§12.4.2.1, §12.5.3.1).",
  "The lab models one execution of the statement. A pending report is discarded if the procedure reaches a flush point before the Observed region of that time step, for example when an always_comb runs again (§12.4.2.1, §12.5.3.1).",
];

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

/** Mounted only inside the revealed part of a prompt, so the parent knows when the answer is on screen. */
function RevealSignal({ onChange }: { onChange: (revealed: boolean) => void }) {
  useEffect(() => {
    onChange(true);
    return () => onChange(false);
  }, [onChange]);
  return null;
}

const code = (text: React.ReactNode) => <code className="rounded bg-muted px-1 font-mono text-[0.95em] [font-variant-ligatures:none]">{text}</code>;

function BitEditor({ name, bits, onChange }: { name: string; bits: Bit4[]; onChange: (bits: Bit4[]) => void }) {
  return (
    <div role="group" aria-label={`Bits of ${name}, most significant first`} className="flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-sm font-semibold text-foreground [font-variant-ligatures:none]">{name}</span>
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
      <span className="font-mono text-xs text-muted-foreground [font-variant-ligatures:none]">= {formatLiteral(bits)}</span>
    </div>
  );
}

function QuickValues({ name, options, current, onPick }: { name: string; options: string[]; current: Bit4[]; onPick: (body: string) => void }) {
  const now = bitsToString(current);
  return (
    <div role="group" aria-label={`Values of ${name} to try`} className="flex flex-wrap gap-1.5">
      {options.map((body) => {
        const literal = `${body.length}'b${body}`;
        const active = body === now;
        return (
          <button
            key={body}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(body)}
            className={cn(
              "min-h-10 rounded-full border px-3 py-1 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [font-variant-ligatures:none]",
              active ? "border-cyan-500 bg-cyan-500/15 font-semibold text-foreground" : "border-border/70 text-muted-foreground hover:bg-muted",
            )}
          >
            {name} = {literal}
          </button>
        );
      })}
    </div>
  );
}

const chipStyle: Record<BitChip["verdict"], string> = {
  "1": "border-emerald-500/70 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  "0": "border-rose-500/70 bg-rose-500/10 text-rose-800 dark:text-rose-200",
  x: valueStyles.unknown.className,
  skip: "border-dashed border-slate-400/80 text-slate-600 dark:text-slate-300",
};

const chipWord: Record<BitChip["verdict"], string> = { "1": "match", "0": "mismatch", x: "unknown, no match", skip: "skipped, a do-not-care" };

/** Style for a 1-bit comparison result (a result is never z; the type still has to be covered). */
const resultStyle = (result: Bit4) => chipStyle[result === "z" ? "x" : result];

/**
 * One comparison bit by bit: the select's bit, the item's bit and the verdict
 * (1, 0, x or – for a skipped do-not-care bit). A table, so a screen reader
 * gets the same columns.
 */
function ChipTable({ chips, caption, leftName, rightName, verdictName }: { chips: BitChip[]; caption: string; leftName: string; rightName: string; verdictName: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-center font-mono text-xs [font-variant-ligatures:none]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              row
            </th>
            {chips.map((c) => (
              <th key={c.index} scope="col" className="w-8 pb-0.5 text-[10px] font-normal text-muted-foreground">
                bit {c.index}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="pr-2 text-left text-[11px] font-normal text-muted-foreground">
              {leftName}
            </th>
            {chips.map((c) => (
              <td key={c.index} className="p-0.5">
                <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded border", valueStyles[classifyValue(c.left)].className)}>{c.left}</span>
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="pr-2 text-left text-[11px] font-normal text-muted-foreground">
              {rightName}
            </th>
            {chips.map((c) => (
              <td key={c.index} className="p-0.5">
                <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded border", valueStyles[classifyValue(c.right)].className)}>{c.right}</span>
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="pr-2 text-left text-[11px] font-semibold text-foreground">
              {verdictName}
            </th>
            {chips.map((c) => (
              <td key={c.index} className="p-0.5">
                <span className={cn("relative inline-flex h-6 w-6 items-center justify-center rounded border font-semibold", chipStyle[c.verdict])}>
                  <span aria-hidden>{c.verdict === "skip" ? "–" : c.verdict}</span>
                  {c.wildcard ? (
                    <span aria-hidden className="absolute -right-1 -top-1 text-[9px] text-emerald-700 dark:text-emerald-300">
                      ?
                    </span>
                  ) : null}
                  <span className="sr-only">
                    {chipWord[c.verdict]}
                    {c.wildcard ? ", wildcard in the item" : ""}
                  </span>
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** What the chips mean, in words a sighted learner can read too. */
function ChipLegend() {
  return <p className="text-xs text-muted-foreground">Chips: 1 match, 0 mismatch, x unknown (no match), – skipped, ? wildcard in the item. A ? in the source is written z here (same bit value).</p>;
}

const hasChips = (result: DecisionResult) => result.items.some((v) => v.terms.some((t) => t.chips));

function StatusBadge({ status }: { status: ItemVerdict["status"] }) {
  if (status === "runs")
    return (
      <strong className={cn("text-xs", comparisonStyles.match.className)}>
        <span aria-hidden>{comparisonStyles.match.glyph} </span>matches and runs
      </strong>
    );
  if (status === "matches-not-run")
    return (
      <strong className="text-xs text-amber-800 dark:text-amber-200">
        <span aria-hidden>◐ </span>matches, not run (the first match wins)
      </strong>
    );
  return (
    <span className={cn("text-xs", comparisonStyles.mismatch.className)}>
      <span aria-hidden>{comparisonStyles.mismatch.glyph} </span>no match
    </span>
  );
}

function NoMatchStamp() {
  return (
    <span className="inline-flex -rotate-2 items-center rounded border-2 border-rose-500/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
      x means no match
    </span>
  );
}

/** The term's verdict with its chips, in one form's vocabulary. */
function TermDetail({ term, result, expressionName, showChips }: { term: TermVerdict; result: DecisionResult; expressionName: string; showChips: boolean }) {
  const { form } = result.config;
  const verdictName = form === "case-inside" ? "==?" : isIfChain(form) ? (term.term.kind === "literal" && /[xXzZ?]/.test(term.term.text) ? "==?" : "==") : form;
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">
        {code(term.text)} <span aria-hidden>→</span> <span className="sr-only">gives</span>
        {term.unsupported ? (
          <span className="ml-1 inline-flex h-5 items-center rounded border border-dashed border-amber-500/70 bg-amber-500/10 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200">
            not comparable
          </span>
        ) : (
          <span className={cn("ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-xs font-semibold", resultStyle(term.result))}>{term.result}</span>
        )}{" "}
        {term.why}
      </p>
      {term.chips && showChips ? <ChipTable chips={term.chips} caption={`${expressionName} against ${term.text}, bit by bit`} leftName={expressionName} rightName="item" verdictName={verdictName} /> : null}
    </div>
  );
}

function ItemCard({ verdict, result, expressionName, showOr }: { verdict: ItemVerdict; result: DecisionResult; expressionName: string; showOr: boolean }) {
  const { form } = result.config;
  // Chips only where the eye should go: a comparison that matched or gave x. A plain miss folds to one line, and its detail stays one tap away.
  const plainMiss = isPlainMiss(verdict);
  const terms = (
    <div className="space-y-2">
      {verdict.terms.map((t, i) => (
        <TermDetail key={i} term={t} result={result} expressionName={expressionName} showChips={plainMiss || t.result !== "0"} />
      ))}
    </div>
  );
  const orLine =
    showOr && verdict.terms.length > 1 ? (
      <p className="text-xs text-muted-foreground">
        OR across the item&apos;s {verdict.terms.length} comparisons ({verdict.terms.map((t) => t.result).join(", ")}) <span aria-hidden>→</span>{" "}
        <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-xs font-semibold", resultStyle(verdict.result))}>{verdict.result}</span>{" "}
        {form === "case-inside" ? "(§11.4.13)" : "(§11.4.7)"}
      </p>
    ) : null;
  return (
    <li
      className={cn(
        "space-y-2 rounded-lg border p-2.5",
        verdict.status === "runs" ? "border-emerald-500/60 bg-emerald-500/10" : verdict.status === "matches-not-run" ? "border-amber-500/50 bg-amber-500/[0.06]" : "border-border/60",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">
          <span className="text-muted-foreground">
            {isIfChain(form) ? "branch" : "item"} {verdict.index + 1}:
          </span>{" "}
          <code className="font-mono font-semibold [font-variant-ligatures:none]">{verdict.text}</code>
          {verdict.label !== verdict.text ? <span className="ml-1 text-xs text-muted-foreground">({verdict.label})</span> : null}
        </span>
        <StatusBadge status={verdict.status} />
      </div>
      {plainMiss ? (
        <details className="space-y-2">
          <summary className="cursor-pointer py-3 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{itemMissLine(verdict)}</summary>
          {terms}
          {orLine}
        </details>
      ) : (
        <>
          {terms}
          {orLine}
        </>
      )}
      {verdict.result === "x" ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
          <NoMatchStamp /> {form === "case-inside" ? "An inside result of 1'bx is no match (§12.5.4)." : "An x condition is false (§12.4)."}
        </p>
      ) : null}
    </li>
  );
}

function ItemList({ result, expressionName, showOr = false }: { result: DecisionResult; expressionName: string; showOr?: boolean }) {
  const { form, catchAll } = result.config;
  const word = itemWord(form);
  return (
    <ol aria-label={`${word}s in source order`} className="space-y-2">
      {result.items.map((v) => (
        <ItemCard key={v.index} verdict={v} result={result} expressionName={expressionName} showOr={showOr} />
      ))}
      {catchAll ? (
        <li className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm", result.runs.kind === "catch-all" ? "border-emerald-500/60 bg-emerald-500/10" : "border-border/60")}>
          <code className="font-mono font-semibold [font-variant-ligatures:none]">{catchAllWord(form)}</code>
          {result.runs.kind === "catch-all" ? (
            <strong className={cn("text-xs", comparisonStyles.match.className)}>
              <span aria-hidden>{comparisonStyles.match.glyph} </span>runs: no {word} matched
            </strong>
          ) : (
            <span className="text-xs text-muted-foreground">not reached</span>
          )}
        </li>
      ) : null}
    </ol>
  );
}

/** Items the lab could not compare in this form (an unlistable range in a case-family statement). Empty for every shipped preset. */
function Caveats({ result }: { result: DecisionResult }) {
  if (result.unsupported.length === 0) return null;
  return (
    <p role="note" aria-label="Not comparable" className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
      <span aria-hidden>⚠ </span>
      {result.unsupported.join(" ")}
    </p>
  );
}

function Ticket({ result }: { result: DecisionResult }) {
  if (result.report) {
    return (
      <div role="note" aria-label="Violation ticket" className="space-y-1 rounded-xl border-2 border-dashed border-rose-500/70 bg-rose-500/[0.06] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">
          <span aria-hidden>✕ </span>Violation report · {result.report.clause}
        </p>
        <p className="font-mono text-sm font-semibold text-foreground [font-variant-ligatures:none]">{result.report.title}</p>
        <p className="text-sm text-foreground/90">{result.report.detail}</p>
        <p className="text-xs text-muted-foreground">
          <span aria-hidden>⏱ </span>
          {result.report.deferred}
        </p>
      </div>
    );
  }
  return (
    <div role="note" aria-label="No violation" className="space-y-1 rounded-xl border border-emerald-500/50 bg-emerald-500/[0.06] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
        <span aria-hidden>✓ </span>Nothing reported
      </p>
      <p className="text-sm text-foreground/90">{result.silentBecause}</p>
    </div>
  );
}

function OutcomeGrid({ result }: { result: DecisionResult }) {
  const { form, qualifier, catchAll } = result.config;
  const formWord = isIfChain(form) ? "if" : FORM_LABELS[form];
  return (
    <div className="overflow-x-auto">
      <table aria-label={`Outcome by qualifier and number of matching ${itemWord(form)}s`} className="w-full border-collapse text-left text-xs">
        <caption className="mb-1 text-left text-xs text-muted-foreground">
          Outcome by qualifier and by how many {itemWord(form)}s match. The ringed cell is this run{catchAll ? `; the ${catchAllWord(form)} changes the first column` : ""}.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="border border-border/60 px-2 py-1 font-medium text-muted-foreground">
              qualifier
            </th>
            {MATCH_COLUMNS.map((c) => (
              <th key={c} scope="col" className="border border-border/60 px-2 py-1 font-medium">
                {matchColumnLabel(c, form)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {QUALIFIERS.map((q) => (
            <tr key={q}>
              <th scope="row" className={cn("border border-border/60 px-2 py-1 font-mono font-semibold [font-variant-ligatures:none]", q === qualifier ? "text-foreground" : "text-muted-foreground")}>
                {q === "plain" ? `plain ${formWord}` : q}
              </th>
              {MATCH_COLUMNS.map((c) => {
                const cell = gridCell(q, c, catchAll, form);
                const live = q === qualifier && c === result.column;
                return (
                  <td
                    key={c}
                    aria-current={live ? "true" : undefined}
                    className={cn(
                      "border border-border/60 px-2 py-1 transition-colors motion-reduce:transition-none",
                      cell.reports ? "font-semibold text-rose-800 dark:text-rose-200" : "text-foreground/85",
                      live && "bg-cyan-500/15 ring-2 ring-inset ring-cyan-500",
                    )}
                  >
                    {cell.reports ? <span aria-hidden>✕ </span> : null}
                    {cell.text}
                    {live ? <span className="sr-only"> (this run)</span> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const sourceLines = (config: DecisionConfig): CodeTraceLine[] => decisionSource(config).map((l) => ({ text: l.text, key: l.key }));

/**
 * Always mounted and empty until the reveal: a screen reader announces text set
 * in a live region it already knows, not one that arrives with its content.
 */
function LiveLine({ text }: { text: string }) {
  return (
    <p className="sr-only" aria-live="polite" data-testid="decision-live-line">
      {text}
    </p>
  );
}

/** What the preset or item set demonstrates, shown only inside the reveal. */
function RevealNote({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p role="note" aria-label={label} className="rounded-lg border border-cyan-500/40 bg-cyan-500/[0.06] px-3 py-2 text-sm text-foreground">
      {children}
    </p>
  );
}

function runOptions(result: DecisionResult): PredictionOption[] {
  return runChoices(result).map((c) => {
    const { correct, feedback } = explainRunChoice(result, c);
    const label = runChoiceLabel(result, c);
    const colon = label.indexOf(": ");
    return {
      id: runOutcomeId(c),
      label: colon > 0 ? (
        <>
          {label.slice(0, colon + 2)}
          {code(label.slice(colon + 2))}
        </>
      ) : (
        label
      ),
      correct,
      feedback,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Qualifiers mode                                                     */
/* ------------------------------------------------------------------ */

function QualifierLab({ preset }: { preset?: string }) {
  const start = findPreset(preset);
  const selectId = useId();
  const [presetId, setPresetId] = useState(start.id);
  const [config, setConfig] = useState<DecisionConfig>(start.config);
  // The two prompts are siblings: the second appears once the first is revealed (committed or skipped), so the reveal pays one inset, not two.
  const [firstRevealed, setFirstRevealed] = useState(false);
  const onFirstReveal = useCallback((v: boolean) => setFirstRevealed(v), []);

  const presetDef = findPreset(presetId);
  const result = useMemo(() => evaluateDecision(config), [config]);
  const lines = useMemo(() => sourceLines(config), [config]);
  const key = `${presetId}|${config.form}|${config.qualifier}|${config.catchAll}|${bitsToString(config.select)}`;
  // Tied to the key, so a new statement is never highlighted or announced in the commit before the prompt's reset takes effect.
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const onReveal = useCallback((v: boolean) => setRevealedKey(v ? key : null), [key]);
  const revealed = revealedKey === key;

  const loadPreset = (id: string) => {
    const p = findPreset(id);
    setPresetId(p.id);
    setConfig(p.config);
  };
  const update = (patch: Partial<DecisionConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const runOpts = useMemo(() => runOptions(result), [result]);
  const reportOpts: PredictionOption[] = useMemo(
    () =>
      REPORT_KINDS.map((k) => {
        const { correct, feedback } = explainReportChoice(result, k);
        return { id: k, label: reportChoiceLabel(k), correct, feedback };
      }),
    [result],
  );

  const expressionName = result.constantExpression ? "1'b1" : config.selectName;
  const word = branchWord(config.form);
  const edited = isPresetEdited(config, presetDef);

  return (
    <VisualFrame
      label="Decision lab: which item runs and what is reported"
      eyebrow="Predict, then experiment"
      title="Which item runs, and what does the qualifier report?"
      summary={
        <>
          Pick a form and a qualifier, edit the select, and predict two things before the reveal: which {word} runs, and what is reported. Every answer is computed from the statement
          shown.
        </>
      }
      fidelity="model"
      assumptions={DECISION_ASSUMPTIONS}
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={selectId} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Preset
          </label>
          <select
            id={selectId}
            value={presetId}
            onChange={(e) => loadPreset(e.target.value)}
            className="h-10 w-full max-w-full rounded-lg border border-border/70 bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {DECISION_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground">{edited ? editedPresetNote(presetDef) : presetDef.summary}</p>
        </div>

        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Statement form</p>
            <SegmentedControl<DecisionForm>
              label="Statement form"
              mono
              value={config.form}
              onChange={(form) => update({ form })}
              options={DECISION_FORMS.map((f) => ({ value: f, label: FORM_LABELS[f] }))}
            />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Qualifier</p>
            <SegmentedControl<Qualifier> label="Qualifier" mono value={config.qualifier} onChange={(qualifier) => update({ qualifier })} options={QUALIFIERS.map((q) => ({ value: q, label: q }))} />
          </div>
        </div>

        <label className="inline-flex min-h-10 items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={config.catchAll} onChange={(e) => update({ catchAll: e.target.checked })} className="h-4 w-4 accent-cyan-600" />
          {isIfChain(config.form) ? "final else" : "default item"}
          <span className="text-xs text-muted-foreground">({isIfChain(config.form) ? "catches every value no condition accepts" : "matches every leftover value"})</span>
        </label>

        <div className="space-y-2">
          <BitEditor name={config.selectName} bits={config.select} onChange={(select) => update({ select })} />
          <QuickValues name={config.selectName} options={presetDef.selectOptions} current={config.select} onPick={(body) => update({ select: parseBits(body) })} />
          <p className="text-xs text-muted-foreground">Activate a bit to cycle it through 0, 1, x and z, or pick one of the values the lesson traces. Any change re-arms the prediction.</p>
        </div>
      </div>

      <CodeTrace label="The statement, generated from these settings" lines={lines} activeKey={revealed ? runningLineKey(result) : undefined} />

      <PredictionPrompt
        resetKey={key}
        question={
          <>
            Which {word} runs when {code(`${config.selectName} = ${formatLiteral(config.select)}`)}?
          </>
        }
        options={runOpts}
      >
        <RevealSignal onChange={onFirstReveal} />
        <p className="text-xs text-muted-foreground">Next, predict what is reported.</p>
      </PredictionPrompt>

      {firstRevealed ? (
        <PredictionPrompt resetKey={key} question="What is reported?" options={reportOpts}>
          <RevealSignal onChange={onReveal} />
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              <strong>Outcome: </strong>
              {result.summary}
            </p>
            <Caveats result={result} />
            <Ticket result={result} />
            {edited ? null : <RevealNote label="About this preset">{presetDef.afterReveal}</RevealNote>}
            <OutcomeGrid result={result} />
            <ItemList result={result} expressionName={expressionName} showOr={config.form === "case-inside" || isIfChain(config.form)} />
            {hasChips(result) ? <ChipLegend /> : null}
          </div>
        </PredictionPrompt>
      ) : null}
      {/* The one line a screen reader is told; the detail above is static, so it is not read a long passage. */}
      <LiveLine text={revealed ? result.summary : ""} />
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Compare mode: casex | case inside                                    */
/* ------------------------------------------------------------------ */

/**
 * True when the running item was accepted on a bit where the SELECT is x or z
 * and the item is a known 0 or 1: casez skips a z, casex an x or z, in the case
 * expression too (§12.5.1), so the unknown went unnoticed. A skipped bit whose
 * item side is a don't-care (?, x, z) is excluded: case inside accepts that one
 * as well (§11.4.6), so nothing hides there.
 */
const hidesUnknownSelect = (result: DecisionResult): boolean =>
  result.items.some((v) => v.status === "runs" && v.terms.some((t) => (t.chips ?? []).some((c) => c.verdict === "skip" && isUnknownBit(c.left) && !isUnknownBit(c.right))));

function CompareColumn({ title, result, expressionName, showOr }: { title: string; result: DecisionResult; expressionName: string; showOr: boolean }) {
  const ranItem = result.runs.kind === "item";
  const unknownSelect = hasUnknown(result.config.select);
  const form = result.config.form;
  return (
    <section aria-label={`${title} column`} className="min-w-0 space-y-3 rounded-xl border border-border/70 bg-background/40 p-3">
      <header>
        <h4 className="font-mono text-sm font-semibold text-foreground [font-variant-ligatures:none]">{title}</h4>
      </header>
      <p className="text-sm text-foreground">
        <strong>Result: </strong>
        {result.summary}
      </p>
      <Caveats result={result} />
      <ItemList result={result} expressionName={expressionName} showOr={showOr} />
      {form !== "case-inside" && hidesUnknownSelect(result) ? (
        <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          <span aria-hidden>⚠ </span>Looks clean: {form === "casez" ? "a z in the select" : "an unknown select"} ran a real branch, because {form} skips {form === "casez" ? "z" : "x and z"} bits in the case expression too
          (§12.5.1). The bug hides.
        </p>
      ) : null}
      {!ranItem && unknownSelect && result.config.form === "case-inside" ? (
        <p className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
          <span aria-hidden>✓ </span>No real branch runs: an x or z in the select is not a wildcard (§11.4.6), every comparison is 0 or x, and x is no match (§12.5.4).{" "}
          {result.config.catchAll ? "The unknown stays visible: it reaches default, where a testbench can report it." : "To see it, add a default that reports it or a unique or priority qualifier (§12.5.3)."}
        </p>
      ) : null}
    </section>
  );
}

function CompareLab({ preset }: { preset?: string }) {
  const startSet = findCompareSet(preset);
  const [setId, setSetId] = useState(startSet.id);
  const [select, setSelect] = useState<Bit4[]>(() => parseBits(startSet.selectOptions[0]));
  const [leftKind, setLeftKind] = useState<CompareLeftKind>("casex");
  // Sibling prompts: the case-inside prompt appears once the left one is revealed (committed or skipped).
  const [firstRevealed, setFirstRevealed] = useState(false);
  const onFirstReveal = useCallback((v: boolean) => setFirstRevealed(v), []);
  const set = findCompareSet(setId);
  const cmp = useMemo(() => compareDecisions(set, select, leftKind), [set, select, leftKind]);
  const key = `${set.id}|${leftKind}|${bitsToString(select)}`;
  // Tied to the key, for the same reason as in QualifierLab.
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const onReveal = useCallback((v: boolean) => setRevealedKey(v ? key : null), [key]);
  const revealed = revealedKey === key;

  const chooseSet = (id: string) => {
    const next = findCompareSet(id);
    setSetId(next.id);
    setSelect(parseBits(next.selectOptions[0]));
  };

  const leftOpts = useMemo(() => runOptions(cmp.left), [cmp.left]);
  const rightOpts = useMemo(() => runOptions(cmp.right), [cmp.right]);
  const leftNote = cmp.leftExpanded ? `written as ${leftKind} with plain items: a range is legal only in case inside (§12.5.4), so the range is listed value by value` : undefined;
  const leftLines = useMemo(() => sourceLines(cmp.left.config), [cmp.left.config]);
  const rightLines = useMemo(() => sourceLines(cmp.right.config), [cmp.right.config]);

  return (
    <VisualFrame
      label="Decision lab: casex versus case inside"
      eyebrow="Compare, then predict"
      title={
        <>
          Same items, same select: {code(leftKind)} beside {code("case inside")}
        </>
      }
      summary={set.summary}
      fidelity="model"
      assumptions={DECISION_ASSUMPTIONS}
    >
      <div className="space-y-3">
        <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Item set</p>
            <SegmentedControl label="Item set" value={set.id} onChange={chooseSet} options={COMPARE_SETS.map((s) => ({ value: s.id, label: s.title }))} />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Left column</p>
            <SegmentedControl<CompareLeftKind>
              label="Left column"
              mono
              value={leftKind}
              onChange={setLeftKind}
              options={[
                { value: "casex", label: "casex" },
                { value: "casez", label: "casez" },
              ]}
            />
          </div>
        </div>
        <div className="space-y-2">
          <BitEditor name={set.selectName} bits={select} onChange={setSelect} />
          <QuickValues name={set.selectName} options={set.selectOptions} current={select} onPick={(body) => setSelect(parseBits(body))} />
          <p className="text-xs text-muted-foreground">Activate a bit to cycle it through 0, 1, x and z. Any change re-arms both predictions.</p>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <div className="min-w-0 space-y-1">
          <CodeTrace label={`${leftKind} (${set.selectName})`} lines={leftLines} activeKey={revealed ? runningLineKey(cmp.left) : undefined} />
          {leftNote ? <p className="text-xs text-muted-foreground">{leftNote}.</p> : null}
        </div>
        <div className="min-w-0">
          <CodeTrace label={`case (${set.selectName}) inside`} lines={rightLines} activeKey={revealed ? runningLineKey(cmp.right) : undefined} />
        </div>
      </div>

      <PredictionPrompt
        resetKey={key}
        question={
          <>
            Under {code(leftKind)}, which item runs when {code(`${set.selectName} = ${formatLiteral(select)}`)}?
          </>
        }
        options={leftOpts}
      >
        <RevealSignal onChange={onFirstReveal} />
        <p className="text-xs text-muted-foreground">Next, predict the {code("case inside")} column.</p>
      </PredictionPrompt>

      {firstRevealed ? (
        <PredictionPrompt resetKey={key} question={<>Under {code("case inside")}, which item runs?</>} options={rightOpts}>
          <RevealSignal onChange={onReveal} />
          <div className="space-y-3">
            <RevealNote label="About this item set">
              {set.afterReveal} {WILDCARD_ASYMMETRY_NOTE}
            </RevealNote>
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
              <CompareColumn title={leftKind} result={cmp.left} expressionName={set.selectName} showOr={false} />
              <CompareColumn title="case inside" result={cmp.right} expressionName={set.selectName} showOr />
            </div>
            <ChipLegend />
          </div>
        </PredictionPrompt>
      ) : null}
      {/* The one line a screen reader is told; the item cards are static. */}
      <LiveLine text={revealed ? `${leftKind}: ${cmp.left.summary} case inside: ${cmp.right.summary}` : ""} />
    </VisualFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export interface DecisionLabProps {
  /** "qualifiers": one statement, its qualifier and its report. "compare": casex beside case inside. */
  mode?: "qualifiers" | "compare";
  /** A preset id from DECISION_PRESETS (qualifiers) or COMPARE_SETS (compare). */
  preset?: string;
}

export default function DecisionLab({ mode = "qualifiers", preset }: DecisionLabProps) {
  return (
    <div data-testid={mode === "compare" ? "decision-lab-compare" : "decision-lab-qualifiers"}>
      {mode === "compare" ? <CompareLab preset={preset} /> : <QualifierLab preset={preset} />}
    </div>
  );
}
