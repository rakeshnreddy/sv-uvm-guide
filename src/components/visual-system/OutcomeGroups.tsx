"use client";

import React, { useId } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Grouped outcomes of an exhaustive "every legal order" run
 * (visual-language.md §6, "Exhaustive check: show grouped outcomes, not one run").
 *
 * Model-agnostic: the caller's model explores the orders and groups the runs;
 * this component only lays the groups out. One group reads "Same outcome in
 * every ..." scoped to what the model explored (`nondeterminism`): only a model
 * that explores both IEEE 1800-2023 §4.7 sources may say "every legal order".
 * Two or more groups sit side by side under the amber "Scheduler choice" badge
 * with the first differing line marked in each card. Group counts that do not
 * add up to `runCount` are reported on the page as a data error, never shown
 * silently.
 */

const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export interface OutcomeLine {
  /** Simulation time as the caller writes it, e.g. "t = 10 ns". */
  time?: string;
  text: string;
}

export interface OutcomeGroup {
  id: string;
  title: string;
  /** How many of the orders run ended in this outcome. */
  runCount: number;
  lines: readonly OutcomeLine[];
  /** Final values, e.g. "q1 = 1, q2 = 1". */
  endState?: string;
  /** Short verdict chip, e.g. "✓ matches flip-flop hardware". */
  badge?: string;
}

/**
 * The IEEE 1800-2023 §4.7 source of nondeterminism the caller's model explored.
 * §4.7 names two: events ready in the Active or Reactive region may be processed
 * in any order, and procedural statements with no time control (# or @) need not
 * run as one event, so processes may be interleaved.
 * - "region-order": the model permutes the ready processes and runs each until
 *   it blocks or ends, without interleaving. The texts say "every order of the
 *   ready processes", never "every legal order".
 * - "interleaving": the model interleaves processes at the points it chooses.
 *   The texts say "every interleaving explored".
 * - "both": the model runs every order both sources allow. Only then do the
 *   texts say "every legal order".
 */
export type NondeterminismSource = "region-order" | "interleaving" | "both";

export interface OutcomeGroupsProps {
  groups: readonly OutcomeGroup[];
  /** Total number of legal orders the model ran. */
  runCount: number;
  /** Zero-based index into each group's `lines` of the first line that differs. Computed from the lines when omitted. */
  firstDivergentStep?: number;
  /** The model stopped before running every legal order. */
  capped?: boolean;
  /** Lets the caller load the chosen run into its own scrubber. Cards are buttons when this is set. */
  onSelect?: (groupId: string) => void;
  /** The group the caller has loaded; shown as selected (aria-pressed). */
  selectedId?: string;
  /** Visible action on each card when `onSelect` is set. */
  selectLabel?: string;
  /** Accessible name of the whole set. */
  label?: string;
  /**
   * Which §4.7 source of nondeterminism the model explored, so the note cites the
   * right rule and the one-outcome texts claim no more than was run. Default
   * "region-order". Pass "both" only when the model runs every order §4.7 allows.
   */
  nondeterminism?: NondeterminismSource;
  /** Extra caller explanation shown after the §4.7 note. */
  note?: React.ReactNode;
  className?: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const ordersText = (n: number) => plural(n, "legal order");

/**
 * Data checks: whole, positive group counts that add up to `runCount`, and
 * unique group ids. Returns one sentence per problem; empty when the data is sound.
 */
export function outcomeProblems(groups: readonly Pick<OutcomeGroup, "id" | "runCount">[], runCount: number): string[] {
  const problems: string[] = [];
  if (!Number.isInteger(runCount) || runCount < 0) problems.push(`runCount ${runCount} is not a whole number of orders`);
  const seen = new Set<string>();
  groups.forEach((g) => {
    if (seen.has(g.id)) problems.push(`group id "${g.id}" is used twice`);
    seen.add(g.id);
    if (!Number.isInteger(g.runCount) || g.runCount < 1) problems.push(`group "${g.id}" has runCount ${g.runCount}; each group needs at least 1 order`);
  });
  const sum = groups.reduce((n, g) => n + g.runCount, 0);
  if (sum !== runCount) problems.push(`the groups count ${plural(sum, "order")} but runCount is ${runCount}`);
  return problems;
}

/** First line index where the groups' lines disagree (text, time, or one group has no line there). */
export function findFirstDivergentLine(groups: readonly Pick<OutcomeGroup, "lines">[]): number | undefined {
  if (groups.length < 2) return undefined;
  const longest = Math.max(...groups.map((g) => g.lines.length));
  for (let i = 0; i < longest; i += 1) {
    const first = groups[0].lines[i];
    const differs = groups.some((g) => {
      const line = g.lines[i];
      return !line || !first || line.text !== first.text || (line.time ?? "") !== (first.time ?? "");
    });
    if (differs) return i;
  }
  return undefined;
}

/**
 * What a single outcome may claim for each source the model explored. Only
 * "both" covers every order §4.7 allows; the others name what was run.
 */
export const EXPLORED_SCOPE: Readonly<Record<NondeterminismSource, { every: string; unchanged: string }>> = {
  "region-order": { every: "every order of the ready processes", unchanged: "no order of the ready processes changes the result" },
  interleaving: { every: "every interleaving explored", unchanged: "no interleaving explored changes the result" },
  both: { every: "every legal order", unchanged: "no legal order changes the result" },
};

/**
 * The sentence the live region reads. With `capped`, it claims nothing about the
 * orders that were not run; with one outcome, it claims only what
 * `nondeterminism` says the model explored.
 */
export function outcomeSummary(groupCount: number, runCount: number, capped = false, nondeterminism: NondeterminismSource = "region-order"): string {
  const orders = capped ? `the ${ordersText(runCount)} run` : ordersText(runCount);
  if (groupCount === 0) return "No outcomes to show.";
  if (groupCount === 1) return capped ? `1 outcome from ${orders}.` : `1 outcome from ${orders}: ${EXPLORED_SCOPE[nondeterminism].unchanged}.`;
  return `${groupCount} different outcomes from ${orders}: the result depends on the scheduler's choice.`;
}

/**
 * The §4.7 note for each source of nondeterminism. Paraphrased, never quoted at
 * length. The "region-order" and "interleaving" notes also say which legal
 * orders the model does not run.
 */
export const SCHEDULER_CLAUSE_NOTES: Readonly<Record<NondeterminismSource, string>> = {
  "region-order":
    "IEEE 1800-2023 §4.7: a simulator may process the events ready in the Active or Reactive region in any order, so each order counted here is a legal run. Each process runs until it blocks (at #, @, wait or another blocking call) or ends, without being interleaved; §4.7 also allows interleaving, which this model does not run.",
  interleaving:
    "IEEE 1800-2023 §4.7: procedural code with no time control (# or @) need not run as one event; the simulator may suspend a process part way and interleave other processes, so each interleaving counted here is a legal order. Only the interleavings this model explores are run; §4.7 also lets the simulator suspend a process at any point while it evaluates a statement, so other legal orders may exist.",
  both: "IEEE 1800-2023 §4.7 names two sources of nondeterminism: the events ready in the Active or Reactive region may be processed in any order, and procedural code with no time control (# or @) may be suspended part way and interleaved with other processes. Each order counted here is a legal run.",
};

/** The default note: region ordering. */
export const SCHEDULER_CLAUSE_NOTE = SCHEDULER_CLAUSE_NOTES["region-order"];

export function OutcomeGroups({
  groups,
  runCount,
  firstDivergentStep,
  capped = false,
  onSelect,
  selectedId,
  selectLabel = "Step through this run",
  label = "Outcomes across legal orders",
  nondeterminism = "region-order",
  note,
  className,
}: OutcomeGroupsProps) {
  const baseId = useId();
  const multi = groups.length > 1;
  const divergent = multi ? (firstDivergentStep ?? findFirstDivergentLine(groups)) : undefined;
  const single = groups.length === 1;
  const ordersRun = `${runCount} order${runCount === 1 ? "" : "s"} run`;
  const scope = EXPLORED_SCOPE[nondeterminism];
  const singleHeading = capped ? `Same outcome in all ${ordersText(runCount)} run` : `Same outcome in ${scope.every} (${ordersRun})`;
  const problems = outcomeProblems(groups, runCount);

  return (
    <div role="group" aria-label={label} className={cn("space-y-3", className)}>
      <div role="status" aria-live="polite" className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {multi ? (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
              Scheduler choice
            </span>
          ) : null}
          <p className="text-sm font-medium text-foreground">{outcomeSummary(groups.length, runCount, capped, nondeterminism)}</p>
        </div>
        {capped ? (
          <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            <span aria-hidden>⚠ </span>
            Capped at {plural(runCount, "order")}; more legal orders exist. The groups below cover only the orders that were run.
          </p>
        ) : null}
      </div>

      {problems.length ? (
        <p role="note" className="text-xs text-rose-700 dark:text-rose-300">
          <span aria-hidden>✕ </span>Outcome data error: {problems.join("; ")}.
        </p>
      ) : null}

      <ul className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]">
        {groups.map((g, gi) => {
          const selected = selectedId !== undefined && selectedId === g.id;
          const heading = single ? singleHeading : g.title;
          const countText = single ? undefined : `${g.runCount} of ${plural(runCount, "order")}`;
          const linesId = `${baseId}-lines-${gi}`;
          const divergentHere = divergent !== undefined && divergent < g.lines.length;
          const name = [
            heading,
            single && g.title ? g.title : undefined,
            countText,
            g.badge,
            g.endState ? `end state ${g.endState}` : undefined,
            divergentHere ? `first difference at line ${(divergent ?? 0) + 1}` : undefined,
          ]
            .filter(Boolean)
            .join(", ");

          const content = (
            <>
              <span className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 text-sm font-semibold text-foreground">{heading}</span>
                {countText ? (
                  <span className="shrink-0 rounded border border-border/70 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{countText}</span>
                ) : null}
              </span>
              {single && g.title ? <span className="mt-1 block text-xs text-muted-foreground">{g.title}</span> : null}
              {g.badge ? (
                <span className="mt-2 inline-block rounded border border-border/70 bg-background/60 px-1.5 py-0.5 text-[11px] font-medium text-foreground">{g.badge}</span>
              ) : null}
              <span id={linesId} className="mt-2 block space-y-1">
                {g.lines.map((line, li) => {
                  const marked = divergent !== undefined && li === divergent;
                  return (
                    <span
                      key={li}
                      className={cn(
                        "block rounded px-2 py-1 text-xs [font-variant-ligatures:none]",
                        marked ? "border-l-2 border-amber-500 bg-amber-500/15 text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {line.time ? <span className="mr-1.5 font-mono text-[11px] opacity-80">{line.time}</span> : null}
                      <span className="break-words">{line.text}</span>
                      {marked ? (
                        <span className="ml-1.5 inline-block rounded bg-amber-500/25 px-1 text-[10px] font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-100">
                          ≠ first difference
                        </span>
                      ) : null}
                    </span>
                  );
                })}
                {g.endState ? (
                  <span className="mt-2 block border-t border-border/60 pt-2 text-xs">
                    <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">End state</span>
                    <span className="font-mono text-foreground [font-variant-ligatures:none]">{g.endState}</span>
                  </span>
                ) : null}
              </span>
              {onSelect ? (
                <span className="mt-2 block text-right text-xs font-medium text-cyan-700 dark:text-cyan-300">
                  {selected ? "● Selected" : `▸ ${selectLabel}`}
                </span>
              ) : null}
            </>
          );

          const shell = cn(
            "block h-full w-full rounded-xl border bg-background/50 p-3 text-left transition-colors duration-200 motion-reduce:transition-none",
            selected ? "border-2 border-cyan-500 bg-cyan-500/[0.06]" : "border-border/70",
          );

          return (
            <li key={g.id} className="min-w-0">
              {onSelect ? (
                <button
                  type="button"
                  aria-label={name}
                  aria-describedby={linesId}
                  aria-pressed={selectedId !== undefined ? selected : undefined}
                  onClick={() => onSelect(g.id)}
                  className={cn(shell, "min-h-10 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
                >
                  {content}
                </button>
              ) : (
                <div role="group" aria-label={name} className={shell}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted-foreground">
        {SCHEDULER_CLAUSE_NOTES[nondeterminism]}
        {single && !capped ? ` Here ${scope.unchanged}.` : null}
        {note ? <> {note}</> : null}
      </p>
    </div>
  );
}

export default OutcomeGroups;
