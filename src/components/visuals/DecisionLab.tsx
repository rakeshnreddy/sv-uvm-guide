"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

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
  chipMarks,
  compareDecisions,
  compareValueNote,
  compareWrapUp,
  decisionSource,
  drawsChips,
  editedPresetNote,
  evaluateDecision,
  explainReportChoice,
  explainRunChoice,
  findCompareSet,
  findPreset,
  freshWhys,
  gridCell,
  isIfChain,
  isPlainMiss,
  isPresetEdited,
  itemMissLine,
  itemWord,
  laterMatchBadge,
  matchColumnLabel,
  nextSelectValue,
  presetValueNote,
  reportChoiceLabel,
  runChoiceLabel,
  runChoices,
  runOutcomeId,
  runningLineKey,
  triedProgress,
  type BitChip,
  type ChipMarks,
  type CompareLeftKind,
  type DecisionConfig,
  type DecisionForm,
  type DecisionResult,
  type ItemVerdict,
  type Qualifier,
  type TermVerdict,
  type TriedProgress,
} from "@/lib/sv-decision-model";
import { BIT4_VALUES, bitsToString, formatLiteral, hasUnknown, isUnknownBit, parseBits, type Bit4 } from "@/lib/sv-four-state-model";
import { cn } from "@/lib/utils";

export const DECISION_ASSUMPTIONS = [
  "Implements IEEE 1800-2023 §12.4–§12.4.2 (if, unique-if, unique0-if, priority-if), §12.5–§12.5.4 (case, casez, casex, the qualifiers, case inside) and §11.4.4, §11.4.6, §11.4.13 (relational, wildcard equality and inside operators).",
  "Matching reuses the four-state model behind the F2A explorer (caseItemMatches and ==?), so the two visuals cannot disagree about a comparison.",
  "The select is unsigned. Items are literals, ranges [lo:hi] and bit-selects. $ bounds, tolerance ranges, strings and side effects in item expressions are not modelled.",
  "A violation is shown as a ticket. At run time a simulator holds the report until the Observed region of the time step and words it in its own way (§12.4.2.1, §12.5.3.1). §12.5.3 also allows a case violation to be reported at compile time when it can be determined then; the lab shows the run-time path.",
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

type RightName = "item" | "literal";

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

const progressText = (progress: TriedProgress) => (progress.complete ? `All ${progress.total} values tried` : `Values tried: ${progress.count} of ${progress.total}`);

function QuickValues({ name, options, current, tried, progress, onPick }: { name: string; options: string[]; current: Bit4[]; tried: readonly string[]; progress: TriedProgress | null; onPick: (body: string) => void }) {
  const now = bitsToString(current);
  return (
    <div className="space-y-1.5">
      <div role="group" aria-label={`Values of ${name} to try`} className="flex flex-wrap gap-1.5">
        {options.map((body) => {
          const literal = `${body.length}'b${body}`;
          const active = body === now;
          const done = tried.includes(body);
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
              {done ? (
                <>
                  <span aria-hidden> ✓</span>
                  <span className="sr-only"> (tried)</span>
                </>
              ) : null}
            </button>
          );
        })}
      </div>
      {progress ? <p className="text-xs text-muted-foreground">{progressText(progress)}</p> : null}
    </div>
  );
}

/** Rule 7: the controls that change the statement stay behind one explicit control, so the question comes first on a phone. */
function ControlFold({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border/70 px-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      >
        <span aria-hidden>{open ? "▾" : "▸"}</span>
        Change the statement
      </button>
      <div id={panelId} hidden={!open} className="mt-3 space-y-3">
        {children}
      </div>
    </div>
  );
}

/**
 * A wrapper that takes focus: when it mounts (focusOnMount), or each time
 * focusTick grows (then it is also scrolled into view). A locked-in prompt
 * unmounts the button that had focus, and without this focus falls to the body.
 */
function Focusable({ label, focusOnMount = false, focusTick = 0, children }: { label: string; focusOnMount?: boolean; focusTick?: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);
  useEffect(() => {
    if (focusTick === 0) return;
    ref.current?.focus({ preventScroll: true });
    // Instant, so it respects prefers-reduced-motion. jsdom has no scrollIntoView.
    ref.current?.scrollIntoView?.({ block: "center" });
  }, [focusTick]);
  return (
    <div ref={ref} tabIndex={-1} role="group" aria-label={label} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {children}
    </div>
  );
}

/** The action at the end of a reveal: on a phone the value chips are a long scroll back up. */
function TryNext({ name, next, progress, onTry }: { name: string; next: string; progress: TriedProgress | null; onTry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onTry}
        className="inline-flex min-h-10 items-center rounded-lg border border-cyan-500 bg-cyan-500/15 px-3 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-cyan-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
      >
        Try next value: {code(`${name} = ${formatLiteral(parseBits(next))}`)}
      </button>
      {progress ? <span className="text-xs text-muted-foreground">{progressText(progress)}</span> : null}
    </div>
  );
}

interface PromptCommit {
  id: string;
  correct: boolean;
}

/** Both prompts' reveal and commit state, tied to the statement's key so nothing outlives a re-arm, not even for one commit. */
function usePredictionPair(key: string) {
  const [firstKey, setFirstKey] = useState<string | null>(null);
  const [secondKey, setSecondKey] = useState<string | null>(null);
  const [firstChoice, setFirstChoice] = useState<PromptCommit | null>(null);
  const [secondChoice, setSecondChoice] = useState<PromptCommit | null>(null);
  const [lastKey, setLastKey] = useState(key);
  // The same reset PredictionPrompt does: coming back to a value must not bring back an old verdict.
  if (key !== lastKey) {
    setLastKey(key);
    setFirstChoice(null);
    setSecondChoice(null);
  }
  return {
    firstRevealed: firstKey === key,
    secondRevealed: secondKey === key,
    firstChoice,
    secondChoice,
    onFirstReveal: useCallback((v: boolean) => setFirstKey(v ? key : null), [key]),
    onSecondReveal: useCallback((v: boolean) => setSecondKey(v ? key : null), [key]),
    onFirstCommit: useCallback((id: string, correct: boolean) => setFirstChoice({ id, correct }), []),
    onSecondCommit: useCallback((id: string, correct: boolean) => setSecondChoice({ id, correct }), []),
  };
}

const verdictText = (choice: PromptCommit | null) => (choice ? (choice.correct ? "Correct. " : "Not quite. ") : "");

/** The feedback a revealed prompt has on screen: the chosen option's, and the correct option's. */
const toldBy = (options: readonly PredictionOption[], choice: PromptCommit | null): string[] =>
  options.filter((o) => o.correct || o.id === choice?.id).map((o) => o.feedback);

const correctFeedback = (options: readonly PredictionOption[]) => options.find((o) => o.correct)?.feedback ?? "";

const addTried = (prev: Readonly<Record<string, string[]>>, group: string, body: string): Record<string, string[]> =>
  prev[group]?.includes(body) ? prev : { ...prev, [group]: [...(prev[group] ?? []), body] };

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
function ChipTable({ chips, caption, leftName, rightName, verdictName }: { chips: BitChip[]; caption: string; leftName: string; rightName: RightName; verdictName: string }) {
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
                    {c.wildcard ? `, wildcard in the ${rightName}` : ""}
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

/** The legend's text: 1 and 0, then only the marks the chip tables draw (the case family never draws x or ?, the ==? forms never skip). */
function chipLegendText(marks: ChipMarks, rightName: RightName): string {
  const keys = ["1 match", "0 mismatch", ...(marks.unknown ? ["x unknown (no match)"] : []), ...(marks.skip ? ["– skipped"] : []), ...(marks.wildcard ? [`? wildcard in the ${rightName}`] : [])];
  return `Chips: ${keys.join(", ")}.${marks.questionMark ? " A ? in the source is written z here (same bit value)." : ""}`;
}

/** What the chips mean, in words a sighted learner can read too. */
function ChipLegend({ rightName, marks }: { rightName: RightName; marks: ChipMarks }) {
  return <p className="text-xs text-muted-foreground">{chipLegendText(marks, rightName)}</p>;
}

/** A plain miss keeps its chips inside its fold; any other comparison that did not simply fail shows them. */
const showsChips = (result: DecisionResult) => result.items.some((v) => !isPlainMiss(v) && v.terms.some((t) => t.chips && t.result !== "0"));

/** The right-hand row of a chip table: an if chain compares with a literal, the case family with an item. */
const rightNameFor = (form: DecisionForm): RightName => (isIfChain(form) ? "literal" : "item");

/** Holds the reveal's chip tables and their legend. The legend shows only while a chip table is on screen, open folds included, and lists only the marks the tables draw. */
function ChipScope({ visible, rightName, marks, children }: { visible: boolean; rightName: RightName; marks: ChipMarks; children: (onFoldToggle: () => void) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [foldOpen, setFoldOpen] = useState(false);
  const onFoldToggle = useCallback(() => setFoldOpen(Boolean(ref.current?.querySelector("details[data-chips][open]"))), []);
  return (
    <div ref={ref} className="space-y-3">
      {children(onFoldToggle)}
      {visible || foldOpen ? <ChipLegend rightName={rightName} marks={marks} /> : null}
    </div>
  );
}

function StatusBadge({ status, config }: { status: ItemVerdict["status"]; config: DecisionConfig }) {
  if (status === "runs")
    return (
      <strong className={cn("text-xs", comparisonStyles.match.className)}>
        <span aria-hidden>{comparisonStyles.match.glyph} </span>matches and runs
      </strong>
    );
  if (status === "matches-not-run")
    return (
      <strong className="text-xs text-amber-800 dark:text-amber-200">
        <span aria-hidden>◐ </span>
        {laterMatchBadge(config.form, config.qualifier)}
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
function TermDetail({ term, why, result, expressionName, showChips }: { term: TermVerdict; why: string; result: DecisionResult; expressionName: string; showChips: boolean }) {
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
        {why}
      </p>
      {term.chips && showChips ? <ChipTable chips={term.chips} caption={`${expressionName} against ${term.text}, bit by bit`} leftName={expressionName} rightName={rightNameFor(form)} verdictName={verdictName} /> : null}
    </div>
  );
}

function ItemCard({ verdict, whys, result, expressionName, showOr, onFoldToggle }: { verdict: ItemVerdict; whys: string[]; result: DecisionResult; expressionName: string; showOr: boolean; onFoldToggle: () => void }) {
  const { form } = result.config;
  // Chips only where the eye should go: a comparison that matched or gave x. A plain miss folds to one line, and its detail stays one tap away.
  const plainMiss = isPlainMiss(verdict);
  const terms = (
    <div className="space-y-2">
      {verdict.terms.map((t, i) => (
        <TermDetail key={i} term={t} why={whys[i]} result={result} expressionName={expressionName} showChips={drawsChips(verdict, t)} />
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
        <StatusBadge status={verdict.status} config={result.config} />
      </div>
      {plainMiss ? (
        <details className="space-y-2" data-chips={verdict.terms.some((t) => t.chips) ? "" : undefined} onToggle={onFoldToggle}>
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
          <NoMatchStamp /> {form === "case-inside" ? "§12.5.4" : "§12.4"}
        </p>
      ) : null}
    </li>
  );
}

function ItemList({ result, told, expressionName, showOr = false, onFoldToggle }: { result: DecisionResult; told: readonly string[]; expressionName: string; showOr?: boolean; onFoldToggle: () => void }) {
  const { form, catchAll } = result.config;
  const word = itemWord(form);
  const whys = freshWhys(result, told);
  return (
    <ol aria-label={`${word}s in source order`} className="space-y-2">
      {result.items.map((v) => (
        <ItemCard key={v.index} verdict={v} whys={whys[v.index]} result={result} expressionName={expressionName} showOr={showOr} onFoldToggle={onFoldToggle} />
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
 * Always mounted: a screen reader announces text set in a live region it already
 * knows, not one that arrives with its content (as a prompt's feedback does).
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

const statementName = (config: DecisionConfig) =>
  `${config.qualifier === "plain" ? "" : `${config.qualifier} `}${FORM_LABELS[config.form]}, ${config.catchAll ? "with" : "no"} ${isIfChain(config.form) ? "final else" : "default"}`;

function QualifierLab({ preset }: { preset?: string }) {
  // Looked up once: an unknown id warns here, and later lookups use ids the page itself offers.
  const [start] = useState(() => findPreset(preset));
  const selectId = useId();
  const [presetId, setPresetId] = useState(start.id);
  const [config, setConfig] = useState<DecisionConfig>(start.config);
  const [rearmNote, setRearmNote] = useState("");
  const [triedBy, setTriedBy] = useState<Record<string, string[]>>({});
  const [focusTick, setFocusTick] = useState(0);

  const presetDef = findPreset(presetId);
  const result = useMemo(() => evaluateDecision(config), [config]);
  const lines = useMemo(() => sourceLines(config), [config]);
  const body = bitsToString(config.select);
  const key = `${presetId}|${config.form}|${config.qualifier}|${config.catchAll}|${body}`;
  const pair = usePredictionPair(key);
  const revealed = pair.secondRevealed;
  const edited = isPresetEdited(config, presetDef);

  // The values-tried walk belongs to the preset's own statement: its text says nothing about an edited one.
  const { onSecondReveal } = pair;
  const onReveal = useCallback(
    (v: boolean) => {
      onSecondReveal(v);
      if (v && !edited) setTriedBy((prev) => addTried(prev, presetId, body));
    },
    [onSecondReveal, edited, presetId, body],
  );
  const tried = triedBy[presetId] ?? [];
  const progress = edited ? null : triedProgress(presetDef.selectOptions, tried);

  const loadPreset = (id: string) => {
    const p = findPreset(id);
    setPresetId(p.id);
    setConfig(p.config);
    setRearmNote(`Preset is now ${p.title}, prediction reset`);
  };
  const update = (patch: Partial<DecisionConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    setRearmNote(patch.select ? `${next.selectName} is now ${formatLiteral(next.select)}, prediction reset` : `Statement is now ${statementName(next)}, prediction reset`);
  };
  const pickValue = (value: string) => {
    if (value !== body) update({ select: parseBits(value) });
  };
  const nextValue = nextSelectValue(presetDef.selectOptions, body, edited ? [] : tried);

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
  const liveText = revealed
    ? `${verdictText(pair.secondChoice)}${result.summary}`
    : pair.firstRevealed
      ? `${verdictText(pair.firstChoice)}${correctFeedback(runOpts)} Next: what is reported?`
      : rearmNote;

  return (
    <VisualFrame
      label="Decision lab: which item runs and what is reported"
      eyebrow="Predict, then experiment"
      title="Which item runs, and what does the qualifier report?"
      summary={<>Pick a value, then predict two things before the reveal: which {word} runs, and what is reported. Every answer is computed from the statement shown.</>}
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

        <QuickValues name={config.selectName} options={presetDef.selectOptions} current={config.select} tried={edited ? [] : tried} progress={progress} onPick={pickValue} />

        <ControlFold>
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
            <span className="text-xs text-muted-foreground">({isIfChain(config.form) ? "runs when no condition matches" : "runs when no item matches"})</span>
          </label>

          <div className="space-y-2">
            <BitEditor name={config.selectName} bits={config.select} onChange={(select) => update({ select })} />
            <p className="text-xs text-muted-foreground">Activate a bit to cycle it through 0, 1, x and z. Any change re-arms the prediction.</p>
          </div>
        </ControlFold>
      </div>

      <CodeTrace label="The statement, generated from these settings" lines={lines} activeKey={revealed ? runningLineKey(result) : undefined} />

      <Focusable label="First prediction" focusTick={focusTick}>
        <PredictionPrompt
          resetKey={key}
          onCommit={pair.onFirstCommit}
          question={
            <>
              Which {word} runs when {code(`${config.selectName} = ${formatLiteral(config.select)}`)}?
            </>
          }
          options={runOpts}
        >
          <RevealSignal onChange={pair.onFirstReveal} />
          <p className="text-xs text-muted-foreground">Next, predict what is reported.</p>
        </PredictionPrompt>
      </Focusable>

      {pair.firstRevealed ? (
        <Focusable label="Second prediction" focusOnMount>
          <PredictionPrompt resetKey={key} onCommit={pair.onSecondCommit} question="What is reported?" options={reportOpts}>
            <RevealSignal onChange={onReveal} />
            <div className="space-y-4">
              <Focusable label="Outcome" focusOnMount>
                <p className="text-sm text-foreground">
                  <strong>Outcome: </strong>
                  {result.ranLine}
                </p>
              </Focusable>
              <Caveats result={result} />
              <Ticket result={result} />
              {edited ? null : <RevealNote label="About this value">{presetValueNote(presetDef, body)}</RevealNote>}
              {progress?.complete ? <RevealNote label="What the values show">{presetDef.wrapUp}</RevealNote> : null}
              <OutcomeGrid result={result} />
              <ChipScope visible={showsChips(result)} rightName={rightNameFor(config.form)} marks={chipMarks(result)}>
                {(onFoldToggle) => (
                  <ItemList
                    result={result}
                    told={[...toldBy(runOpts, pair.firstChoice), ...toldBy(reportOpts, pair.secondChoice)]}
                    expressionName={expressionName}
                    showOr={config.form === "case-inside" || isIfChain(config.form)}
                    onFoldToggle={onFoldToggle}
                  />
                )}
              </ChipScope>
              <TryNext
                name={config.selectName}
                next={nextValue}
                progress={progress}
                onTry={() => {
                  pickValue(nextValue);
                  setFocusTick((t) => t + 1);
                }}
              />
            </div>
          </PredictionPrompt>
        </Focusable>
      ) : null}
      {/* What a screen reader is told; the detail above is static, so it is not read a long passage. */}
      <LiveLine text={liveText} />
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

function CompareColumn({ title, result, told, expressionName, showOr, onFoldToggle }: { title: string; result: DecisionResult; told: readonly string[]; expressionName: string; showOr: boolean; onFoldToggle: () => void }) {
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
        {result.ranLine}
      </p>
      <Caveats result={result} />
      <ItemList result={result} told={told} expressionName={expressionName} showOr={showOr} onFoldToggle={onFoldToggle} />
      {form !== "case-inside" && hidesUnknownSelect(result) ? (
        <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          <span aria-hidden>⚠ </span>Looks clean: {form === "casez" ? "a z in the select" : "an unknown select"} ran a real branch, because {form} skips {form === "casez" ? "z" : "x and z"} bits in the case expression too
          (§12.5.1). The bug hides.
        </p>
      ) : null}
      {/* Only what the prompt and the x stamps do not already say: what makes the unknown visible. */}
      {!ranItem && unknownSelect && result.config.form === "case-inside" ? (
        <p className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
          <span aria-hidden>✓ </span>No real branch runs.{" "}
          {result.config.catchAll ? "The unknown stays visible: it reaches default, where a testbench can report it." : "To see the unknown, add a default that reports it or a unique or priority qualifier (§12.5.3)."}
        </p>
      ) : null}
    </section>
  );
}

function CompareLab({ preset }: { preset?: string }) {
  // Looked up once: an unknown id warns here, and later lookups use ids the page itself offers.
  const [startSet] = useState(() => findCompareSet(preset));
  const [setId, setSetId] = useState(startSet.id);
  const [select, setSelect] = useState<Bit4[]>(() => parseBits(startSet.selectOptions[0]));
  const [leftKind, setLeftKind] = useState<CompareLeftKind>("casex");
  const [rearmNote, setRearmNote] = useState("");
  const [triedBy, setTriedBy] = useState<Record<string, string[]>>({});
  const [focusTick, setFocusTick] = useState(0);
  const set = findCompareSet(setId);
  const cmp = useMemo(() => compareDecisions(set, select, leftKind), [set, select, leftKind]);
  const body = bitsToString(select);
  const key = `${set.id}|${leftKind}|${body}`;
  const pair = usePredictionPair(key);
  const revealed = pair.secondRevealed;

  // The walk is per left column: a value tried under casex has yet to be predicted under casez.
  const group = `${set.id}|${leftKind}`;
  const { onSecondReveal } = pair;
  const onReveal = useCallback(
    (v: boolean) => {
      onSecondReveal(v);
      if (v) setTriedBy((prev) => addTried(prev, group, body));
    },
    [onSecondReveal, group, body],
  );
  const tried = triedBy[group] ?? [];
  const progress = triedProgress(set.selectOptions, tried);

  const chooseSet = (id: string) => {
    const next = findCompareSet(id);
    setSetId(next.id);
    setSelect(parseBits(next.selectOptions[0]));
    setRearmNote(`Item set is now ${next.title}, prediction reset`);
  };
  const chooseLeft = (kind: CompareLeftKind) => {
    setLeftKind(kind);
    setRearmNote(`Left column is now ${kind}, prediction reset`);
  };
  const changeSelect = (bits: Bit4[]) => {
    setSelect(bits);
    setRearmNote(`${set.selectName} is now ${formatLiteral(bits)}, prediction reset`);
  };
  const pickValue = (value: string) => {
    if (value !== body) changeSelect(parseBits(value));
  };
  const nextValue = nextSelectValue(set.selectOptions, body, tried);

  const leftOpts = useMemo(() => runOptions(cmp.left), [cmp.left]);
  const rightOpts = useMemo(() => runOptions(cmp.right), [cmp.right]);
  // The restriction is the grammar of §12.5 (Syntax 12-3); §12.5.4 defines the range_list comparison.
  const leftNote = cmp.leftExpanded ? `written as ${leftKind} with plain items: a range is legal only in case inside (§12.5, §12.5.4), so the range is listed value by value` : undefined;
  const leftLines = useMemo(() => sourceLines(cmp.left.config), [cmp.left.config]);
  const rightLines = useMemo(() => sourceLines(cmp.right.config), [cmp.right.config]);
  const liveText = revealed
    ? `${verdictText(pair.secondChoice)}${leftKind}: ${cmp.left.ranLine} case inside: ${cmp.right.ranLine}`
    : pair.firstRevealed
      ? `${verdictText(pair.firstChoice)}${correctFeedback(leftOpts)} Next: predict the case inside column.`
      : rearmNote;

  return (
    <VisualFrame
      label={`Decision lab: ${leftKind} versus case inside`}
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
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Item set</p>
          <SegmentedControl label="Item set" value={set.id} onChange={chooseSet} options={COMPARE_SETS.map((s) => ({ value: s.id, label: s.title }))} />
        </div>
        <QuickValues name={set.selectName} options={set.selectOptions} current={select} tried={tried} progress={progress} onPick={pickValue} />
        <ControlFold>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Left column</p>
            <SegmentedControl<CompareLeftKind>
              label="Left column"
              mono
              value={leftKind}
              onChange={chooseLeft}
              options={[
                { value: "casex", label: "casex" },
                { value: "casez", label: "casez" },
              ]}
            />
          </div>
          <div className="space-y-2">
            <BitEditor name={set.selectName} bits={select} onChange={changeSelect} />
            <p className="text-xs text-muted-foreground">Activate a bit to cycle it through 0, 1, x and z. Any change re-arms both predictions.</p>
          </div>
        </ControlFold>
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

      <Focusable label="First prediction" focusTick={focusTick}>
        <PredictionPrompt
          resetKey={key}
          onCommit={pair.onFirstCommit}
          question={
            <>
              Under {code(leftKind)}, which item runs when {code(`${set.selectName} = ${formatLiteral(select)}`)}?
            </>
          }
          options={leftOpts}
        >
          <RevealSignal onChange={pair.onFirstReveal} />
          <p className="text-xs text-muted-foreground">Next, predict the {code("case inside")} column.</p>
        </PredictionPrompt>
      </Focusable>

      {pair.firstRevealed ? (
        <Focusable label="Second prediction" focusOnMount>
          <PredictionPrompt resetKey={key} onCommit={pair.onSecondCommit} question={<>Under {code("case inside")}, which item runs?</>} options={rightOpts}>
            <RevealSignal onChange={onReveal} />
            <div className="space-y-3">
              <Focusable label="Outcome" focusOnMount>
                <RevealNote label="About this value">
                  {compareValueNote(set, select, leftKind)} {WILDCARD_ASYMMETRY_NOTE}
                </RevealNote>
              </Focusable>
              {progress.complete ? <RevealNote label="What the values show">{compareWrapUp(set, leftKind)}</RevealNote> : null}
              <ChipScope visible={showsChips(cmp.left) || showsChips(cmp.right)} rightName="item" marks={chipMarks(cmp.left, cmp.right)}>
                {(onFoldToggle) => (
                  <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
                    <CompareColumn title={leftKind} result={cmp.left} told={toldBy(leftOpts, pair.firstChoice)} expressionName={set.selectName} showOr={false} onFoldToggle={onFoldToggle} />
                    <CompareColumn title="case inside" result={cmp.right} told={toldBy(rightOpts, pair.secondChoice)} expressionName={set.selectName} showOr onFoldToggle={onFoldToggle} />
                  </div>
                )}
              </ChipScope>
              <TryNext
                name={set.selectName}
                next={nextValue}
                progress={progress}
                onTry={() => {
                  pickValue(nextValue);
                  setFocusTick((t) => t + 1);
                }}
              />
            </div>
          </PredictionPrompt>
        </Focusable>
      ) : null}
      {/* What a screen reader is told; the item cards are static. */}
      <LiveLine text={liveText} />
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
