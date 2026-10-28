"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { ownerStyles } from "@/components/visual-system/visual-language";
import {
  PACKET_EXAMPLE,
  SUMMARY_LINE_PATTERN,
  allInRange,
  axisCellFor,
  bestFollowUp,
  binHits,
  correctOptions,
  fillTemplate,
  followUpApplies,
  followUpOptionById,
  formatSource,
  getScenarioDeck,
  gradeAnswer,
  implicationWindowAttempts,
  isAnswerComplete,
  optionById,
  otherOptions,
  resolveCopy,
  selectCards,
  summaryMatcherAccepts,
  tallyAnswers,
  type AnchorId,
  type CardAnswer,
  type DeckCopy,
  type ScenarioDeck,
  type ScenarioDeckId,
  type SorterCard,
  type SorterOption,
  type Verdict,
} from "@/lib/scenario-sorter-decks";
import { cn } from "@/lib/utils";

export interface ScenarioSorterProps {
  /** Which drill to run; each lesson use has its own deck. */
  deck: ScenarioDeckId;
  /** A subset of the deck, by card id, in the order given. */
  cards?: string[];
  /** A subset of the deck's bins, by bin id, for a lesson that has not taught the others yet. */
  bins?: string[];
  /** Replaces the deck's title. */
  title?: string;
  /** Prefix for data-testid hooks (default "sorter"). */
  testIdPrefix?: string;
}

const verdictTone: Record<Verdict, string> = {
  correct: "text-emerald-700 dark:text-emerald-300",
  partial: "text-amber-800 dark:text-amber-200",
  wrong: "text-rose-700 dark:text-rose-300",
};
const verdictBox: Record<Verdict, string> = {
  correct: "border-emerald-500/60 bg-emerald-500/10",
  partial: "border-amber-500/60 bg-amber-500/10",
  wrong: "border-rose-500/60 bg-rose-500/10",
};
const verdictGlyph: Record<Verdict, string> = { correct: "✓", partial: "◐", wrong: "✕" };
const verdictSr: Record<Verdict, string> = { correct: "Correct: ", partial: "Partly correct: ", wrong: "Incorrect: " };

const choiceButton =
  "min-h-10 rounded-lg border px-3 py-2 text-left text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";
const monoText = "font-mono [font-variant-ligatures:none]";
const codePanel = "overflow-x-auto rounded-lg bg-slate-950/90 p-3 font-mono text-[12.5px] leading-5 text-slate-100 [font-variant-ligatures:none]";
const smallCaps = "text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground";

function ChoiceButton({
  option,
  testId,
  chosen,
  locked,
  revealed,
  copy,
  onPick,
}: {
  option: SorterOption;
  testId: string;
  chosen: boolean;
  locked: boolean;
  revealed: boolean;
  copy: DeckCopy;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={locked}
      aria-pressed={chosen}
      onClick={onPick}
      className={cn(
        choiceButton,
        option.mono && monoText,
        !locked && "border-border/70 bg-background/60 hover:bg-muted",
        locked && !revealed && (chosen ? "border-amber-500/70 bg-amber-500/10" : "border-border/50 opacity-70"),
        revealed && option.verdict === "correct" && "border-emerald-500/70 bg-emerald-500/10",
        revealed && option.verdict === "partial" && "border-amber-500/70 bg-amber-500/10",
        revealed && chosen && option.verdict === "wrong" && "border-rose-500/70 bg-rose-500/10",
        revealed && !chosen && option.verdict === "wrong" && "border-border/50 opacity-70",
        // The learner's own pick stays recognisable among several ✓ or ◐ options.
        revealed && chosen && "border-2 shadow-sm",
      )}
    >
      {option.label}
      {locked && !revealed && chosen ? <span className="ml-2 font-sans text-xs text-amber-800 dark:text-amber-200">{copy.pickBadge}</span> : null}
      {revealed && option.verdict === "correct" ? <span className="ml-2 font-sans text-xs text-emerald-700 dark:text-emerald-300">{copy.bestBadge}</span> : null}
      {revealed && option.verdict === "partial" ? <span className="ml-2 font-sans text-xs text-amber-800 dark:text-amber-200">{copy.partialBadge}</span> : null}
      {revealed && chosen && option.verdict === "wrong" ? <span className="ml-2 font-sans text-xs text-rose-700 dark:text-rose-300">{copy.chosenBadge}</span> : null}
      {revealed && chosen && option.verdict !== "wrong" ? (
        <span className="ml-2 font-sans text-xs font-semibold text-foreground" data-testid={`${testId}-pick`}>
          {copy.pickBadge}
        </span>
      ) : null}
    </button>
  );
}

/**
 * The card's subject. A single line (a log message, a statement) wraps, as a
 * regression log does: on a phone the panel holds about 40 mono characters, and
 * the key words of a compile message sit at its end. Multi-line code keeps its
 * layout and scrolls sideways.
 */
function CodeBlock({ code, label, id }: { code: string; label?: string; id?: string }) {
  const singleLine = !code.includes("\n");
  return (
    <div className="min-w-0" id={id}>
      {label ? <p className={cn("mb-1", smallCaps)}>{label}</p> : null}
      <pre className={cn(codePanel, singleLine && "whitespace-pre-wrap break-words")} data-wrap={singleLine ? "true" : undefined}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** The log as the learner sees it; after the reveal, the real matcher marks each line it accepts. */
function LogBlock({ lines, label, revealed, testId, id }: { lines: string[]; label?: string; revealed: boolean; testId: string; id?: string }) {
  const accepts = summaryMatcherAccepts(lines);
  return (
    <div className={cn(codePanel, "min-w-0")} data-testid={testId} id={id}>
      {label ? <p className="mb-1 font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p> : null}
      <ol className="space-y-0.5">
        {lines.map((line, i) => {
          const matches = revealed && SUMMARY_LINE_PATTERN.test(line);
          return (
            <li key={`${i}-${line}`} className="flex flex-wrap items-baseline gap-x-2">
              <span className="whitespace-pre-wrap break-words">{line}</span>
              {matches ? <span className="font-sans text-[11px] text-emerald-300">✓ matches ^PASS=\d+ FAIL=0$</span> : null}
            </li>
          );
        })}
      </ol>
      {revealed ? (
        <p className="mt-2 font-sans text-xs text-slate-300">{accepts ? "The matcher accepts this log." : "No line matches: the matcher rejects this log."}</p>
      ) : null}
    </div>
  );
}

function Step2Line({ lead, option, className }: { lead: string; option: SorterOption; className: string }) {
  return (
    <div className={className}>
      <p>
        <strong>{lead}: </strong>
        <code className={cn("break-words", option.mono && monoText)}>{option.label}</code>
      </p>
      <p>{option.feedback}</p>
    </div>
  );
}

/**
 * "Why not the others?": the options the reveal has not explained, behind a
 * toggle, so every option's feedback can be read without crowding the verdict.
 * Collapsed, its panel is empty.
 */
function OtherOptions({ card, answer, copy, testId }: { card: SorterCard; answer: CardAnswer; copy: DeckCopy; testId: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const { options, step2 } = otherOptions(card, answer);
  if (options.length + step2.length === 0) return null;
  const item = (o: SorterOption, step: boolean) => {
    const id = `${step ? "step2-" : ""}${o.id}`;
    return (
      <li key={id} data-testid={`${testId}-${id}`}>
        <p className="text-foreground">
          {step ? <span>Step 2: </span> : null}
          {o.mono ? <code className={cn("break-words", monoText)}>{o.label}</code> : <strong>{o.label}</strong>}
          {o.verdict === "partial" ? <span className="ml-2 text-xs text-amber-800 dark:text-amber-200">{copy.partialBadge}</span> : null}
        </p>
        <p>{o.feedback}</p>
      </li>
    );
  };
  return (
    <div data-testid={testId}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        data-testid={`${testId}-toggle`}
        className="min-h-10 rounded-lg border border-border/70 px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden>{open ? "▾ " : "▸ "}</span>
        {copy.othersToggle}
      </button>
      <div id={panelId} hidden={!open}>
        {open ? (
          <ul className="mt-2 space-y-2 text-muted-foreground">
            {options.map((o) => item(o, false))}
            {step2.map((o) => item(o, true))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Anchor pictures (sv-features): one shared Packet example, static           */
/* ------------------------------------------------------------------------- */

interface AnchorProps {
  testId: string;
  /** A card-specific line under the caption (SorterCard.anchorNote). */
  note?: string;
}

/** Each picture names what it draws: only the constraint and coverage pictures show the Packet example. */
function AnchorShell({ testId, heading, caption, note, children }: AnchorProps & { heading: string; caption: React.ReactNode; children: React.ReactNode }) {
  return (
    <figure data-testid={testId} className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-3">
      <p className={smallCaps} data-testid={`${testId}-heading`}>
        <span aria-hidden>◇ </span>Picture: {heading}
      </p>
      {children}
      <figcaption className="space-y-1 text-xs text-muted-foreground">
        <span className="block">{caption}</span>
        {note ? (
          <span className="block text-foreground" data-testid={`${testId}-note`}>
            {note}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

function ConstraintAnchor({ testId, note }: AnchorProps) {
  const { lengthRange, legal, samples } = PACKET_EXAMPLE;
  const x = (v: number) => 16 + (v - lengthRange.lo) * (288 / (lengthRange.hi - lengthRange.lo));
  const inside = allInRange(samples, legal.lo, legal.hi);
  const label = `Number line of length from ${lengthRange.lo} to ${lengthRange.hi}. The band [${legal.lo}:${legal.hi}] is shaded, and ${
    inside ? `all ${samples.length} randomized values (${samples.join(", ")}) fall inside it; nothing lands at 0 or above ${legal.hi}` : "some values fall outside it"
  }.`;
  return (
    <AnchorShell
      testId={testId}
      heading="the Packet example's length constraint"
      note={note}
      caption={
        <>
          <code className={monoText}>{"constraint c_len { length inside {[1:99]}; }"}</code>: every value randomize() assigns to length lies in the band.
        </>
      }
    >
      <svg viewBox="0 0 320 72" role="img" aria-label={label} className="w-full max-w-[360px] text-foreground">
        <rect x={x(legal.lo)} y={26} width={x(legal.hi) - x(legal.lo)} height={26} rx={3} className="fill-cyan-500/15 stroke-cyan-600 dark:stroke-cyan-400" />
        <text x={(x(legal.lo) + x(legal.hi)) / 2} y={20} fontSize={10} textAnchor="middle" fill="currentColor">
          {"legal: [1:99]"}
        </text>
        <line x1={x(lengthRange.lo)} y1={39} x2={x(lengthRange.hi)} y2={39} stroke="currentColor" strokeOpacity={0.5} />
        {samples.map((v) => (
          <circle key={v} cx={x(v)} cy={39} r={3.5} className="fill-cyan-700 dark:fill-cyan-300" />
        ))}
        {[lengthRange.lo, legal.hi, lengthRange.hi].map((v) => (
          <text key={v} x={x(v)} y={66} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.8}>
            {v}
          </text>
        ))}
      </svg>
    </AnchorShell>
  );
}

function CoverageAnchor({ testId, note }: AnchorProps) {
  const { samples, coverBins } = PACKET_EXAMPLE;
  const hits = binHits(samples, coverBins);
  const label = `Coverage after the same ${samples.length} values: ${hits
    .map((h, i) => `bin ${h.name} [${coverBins[i].lo}:${coverBins[i].hi}] hit ${h.hits} time${h.hits === 1 ? "" : "s"}`)
    .join(", ")}.`;
  return (
    <AnchorShell
      testId={testId}
      heading="coverage of the Packet example's length"
      note={note}
      caption={
        <>
          <code className={monoText}>{"bins low = {[1:32]}; bins high = {[33:99]};"}</code> each counts the sampled values that land in it. A bin still at 0 is a case
          that never happened.
        </>
      }
    >
      <div role="img" aria-label={label} className="space-y-1.5">
        {hits.map((h, i) => (
          <div key={h.name} className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cn("w-24 shrink-0 text-foreground", monoText)}>
              {h.name} [{coverBins[i].lo}:{coverBins[i].hi}]
            </span>
            <span className="flex gap-0.5" aria-hidden>
              {samples.map((_, slot) => (
                <span
                  key={slot}
                  className={cn("h-3.5 w-3.5 rounded-sm border", slot < h.hits ? "border-indigo-500/70 bg-indigo-500/50" : "border-dashed border-border bg-transparent")}
                />
              ))}
            </span>
            <span className="text-muted-foreground">{h.hits} hits</span>
          </div>
        ))}
      </div>
    </AnchorShell>
  );
}

function AssertionAnchor({ testId, note }: AnchorProps) {
  const { req, gnt, window: win } = PACKET_EXAMPLE;
  const attempts = implicationWindowAttempts(req, gnt, win.min, win.max);
  const rows: [string, readonly number[], number][] = [
    ["req", req, 34],
    ["gnt", gnt, 58],
  ];
  const checked = attempts.filter((a) => a.status !== "vacuous");
  const vacuous = attempts.length - checked.length;
  const x = (edge: number) => 66 + edge * 25;
  const label = `req |-> ##[${win.min}:${win.max}] gnt over ${attempts.length} rising edges. ${checked
    .map((a) => `Attempt from edge ${a.start} ${a.status === "pass" ? `passes at edge ${a.end}` : a.status === "fail" ? `fails at edge ${a.end}` : "is still pending"}.`)
    .join(" ")} At the other ${vacuous} edges req is 0, so those attempts succeed vacuously.`;
  return (
    <AnchorShell
      testId={testId}
      heading="req and gnt over ten clock edges"
      note={note}
      caption={
        <>
          <code className={monoText}>{"req |-> ##[1:3] gnt"}</code>: each edge where req is sampled 1 opens a window of edges 1 to 3 later. gnt in the window passes;
          none fails at the window's end.
        </>
      }
    >
      <svg viewBox="0 0 320 132" role="img" aria-label={label} className="w-full max-w-[360px] text-foreground">
        <text x={4} y={14} fontSize={10} fill="currentColor" fillOpacity={0.8}>
          edge
        </text>
        {req.map((_, e) => (
          <text key={`e${e}`} x={x(e)} y={14} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.8}>
            {e}
          </text>
        ))}
        {rows.map(([name, values, y]) => (
          <g key={name}>
            <text x={4} y={y} fontSize={11} fill="currentColor" className={monoText}>
              {name}
            </text>
            {values.map((v, e) => (
              <g key={e}>
                <rect x={x(e) - 10} y={y - 12} width={20} height={16} rx={3} className={v ? "fill-cyan-500/25 stroke-cyan-600 dark:stroke-cyan-400" : "fill-slate-500/10 stroke-slate-400/60"} />
                <text x={x(e)} y={y} fontSize={10} textAnchor="middle" fill="currentColor">
                  {v}
                </text>
              </g>
            ))}
          </g>
        ))}
        {checked.map((a, i) => {
          const end = a.end ?? a.start + win.max;
          const y = 74 + i * 26;
          const pass = a.status === "pass";
          return (
            <g key={a.start}>
              <rect
                x={x(a.start + win.min) - 11}
                y={y}
                width={x(a.start + win.max) - x(a.start + win.min) + 22}
                height={20}
                rx={4}
                strokeDasharray="4 3"
                className={pass ? "fill-emerald-500/10 stroke-emerald-600 dark:stroke-emerald-400" : "fill-rose-500/10 stroke-rose-600 dark:stroke-rose-400"}
              />
              <text x={x(a.start) - 10} y={y + 14} fontSize={9.5} textAnchor="end" fill="currentColor">
                {`from ${a.start}`}
              </text>
              <text x={x(end)} y={y + 14} fontSize={11} textAnchor="middle" className={pass ? "fill-emerald-700 dark:fill-emerald-300" : "fill-rose-700 dark:fill-rose-300"}>
                {pass ? "✓" : "✕"}
              </text>
            </g>
          );
        })}
      </svg>
    </AnchorShell>
  );
}

function OwnerBox({ owner, name, detail, highlight }: { owner: "design" | "testbench"; name: string; detail: string; highlight?: boolean }) {
  const style = ownerStyles[owner];
  return (
    <div className={cn("min-w-0 border px-3 py-2 text-xs", style.className, highlight && "ring-2 ring-cyan-500")}>
      <p className="flex items-center gap-1 font-semibold">
        <span className="rounded border border-current px-1 text-[10px]">{style.tag}</span>
        <span className={monoText}>{name}</span>
      </p>
      <p className={cn("mt-0.5", monoText)}>{detail}</p>
    </div>
  );
}

function ClassAnchor({ testId, note }: AnchorProps) {
  return (
    <AnchorShell
      testId={testId}
      heading="one driver class, two tests"
      note={note}
      caption="One class is the blueprint. Each test calls new() and gets its own driver object; the driver's code is written once."
    >
      <div
        role="img"
        aria-label="One class, driver, is the blueprint. Two tests, test_smoke and test_burst, each call new() and get their own driver object."
        className="space-y-2"
      >
        <OwnerBox owner="testbench" name="class driver;" detail="task run(); … endclass" highlight />
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))]">
          {["test_smoke", "test_burst"].map((t) => (
            <div key={t} className="min-w-0 space-y-1">
              <p className="text-center text-[11px] text-muted-foreground">
                <span aria-hidden>▼ </span>new()
              </p>
              <OwnerBox owner="testbench" name={t} detail="drv = new();" />
            </div>
          ))}
        </div>
      </div>
    </AnchorShell>
  );
}

function SharedAnchor({ testId, note, focus }: AnchorProps & { focus: "package" | "interface" }) {
  const label =
    focus === "package"
      ? "One typedef, packet_t in package types_pkg, is imported by both the RTL module dut and the testbench tb_top, so both sides use the same type. The interface bus_if connects them."
      : "One interface, bus_if, bundles valid, ready and data. The RTL module dut and the testbench tb_top both connect to it, and both import packet_t from types_pkg.";
  return (
    <AnchorShell
      testId={testId}
      heading={focus === "package" ? "one package, used by both sides" : "one interface, connected to both sides"}
      note={note}
      caption={
        focus === "package"
          ? "The typedef is written once, in the package; the RTL and the testbench import the same declaration."
          : "The signals are bundled once, in the interface; the RTL and the testbench connect to the same bundle."
      }
    >
      <div role="img" aria-label={label} className="space-y-2">
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))]">
          <div className={cn("min-w-0 rounded-md border px-3 py-2 text-xs", focus === "package" ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500" : "border-border/70")}>
            <p className="font-semibold text-foreground">package types_pkg</p>
            <p className={cn("text-muted-foreground", monoText)}>typedef struct packed {"{ … }"} packet_t;</p>
          </div>
          <div className={cn("min-w-0 rounded-md border border-dashed px-3 py-2 text-xs", focus === "interface" ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500" : "border-border/70")}>
            <p className="font-semibold text-foreground">interface bus_if</p>
            <p className={cn("text-muted-foreground", monoText)}>valid, ready, data</p>
          </div>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          <span aria-hidden>▼ </span>
          {focus === "package" ? "import types_pkg::*; on both sides" : "both sides connect to bus_if"}
        </p>
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))]">
          <OwnerBox owner="design" name="module dut" detail="packet_t pkt; port: bus_if" />
          <OwnerBox owner="testbench" name="module tb_top" detail="packet_t exp; bus_if instance" />
        </div>
      </div>
    </AnchorShell>
  );
}

function AnchorFigure({ id, testId, note }: AnchorProps & { id: AnchorId }) {
  switch (id) {
    case "constraint":
      return <ConstraintAnchor testId={testId} note={note} />;
    case "coverage":
      return <CoverageAnchor testId={testId} note={note} />;
    case "assertion":
      return <AssertionAnchor testId={testId} note={note} />;
    case "class":
      return <ClassAnchor testId={testId} note={note} />;
    case "package":
    case "interface":
      return <SharedAnchor testId={testId} note={note} focus={id} />;
  }
}

/* ------------------------------------------------------------------------- */
/* Compile stack (uvm-compile-triage) and axis grid                           */
/* ------------------------------------------------------------------------- */

function CompileStack({ deck, card, testId }: { deck: ScenarioDeck; card: SorterCard; testId: string }) {
  if (!card.stack) return null;
  const fault = card.stack;
  const topFirst = [...deck.bins].reverse();
  return (
    <figure data-testid={testId} className="space-y-1.5">
      <p className={smallCaps}>Compile stack, top layer first</p>
      <ol className="space-y-1" aria-label="Compile stack, top layer first">
        {topFirst.map((bin) => {
          const faulty = bin.id === fault.layer;
          return (
            <li
              key={bin.id}
              className={cn("flex flex-wrap items-baseline gap-x-2 rounded-md border px-3 py-1.5 text-xs", faulty ? "border-rose-500/70 bg-rose-500/10" : "border-border/70 bg-background/60")}
            >
              <span className={cn("text-foreground", bin.mono && monoText, faulty && "line-through decoration-rose-500 decoration-2")}>{bin.label}</span>
              {faulty ? (
                <span className="font-semibold text-rose-700 dark:text-rose-300">
                  <span className="sr-only">struck out: </span>
                  <span aria-hidden>✕ </span>
                  {fault.status}
                </span>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-300">
                  <span aria-hidden>✓ </span>
                  <span className="sr-only">present</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

function AxisGrid({
  deck,
  cards,
  answers,
  highlightId,
  showVerdicts,
  testId,
}: {
  deck: ScenarioDeck;
  cards: SorterCard[];
  answers: Record<string, CardAnswer>;
  highlightId?: string;
  showVerdicts?: boolean;
  testId: string;
}) {
  const axis = deck.axis;
  if (!axis) return null;
  const placed = cards.map((card) => ({ card, cell: axisCellFor(deck, card) }));
  return (
    <figure data-testid={testId} className="min-w-0 space-y-1.5">
      <p className={smallCaps}>{axis.title}</p>
      <table className="w-full table-fixed border-separate border-spacing-1 text-xs">
        <caption className="sr-only">{axis.title}</caption>
        <thead>
          <tr>
            {axis.rowLabel ? (
              <th scope="col" className="w-[26%] text-left align-bottom font-medium text-muted-foreground">
                {axis.rowLabel}
              </th>
            ) : (
              // No row label: an empty corner, not an empty column header.
              <td aria-hidden="true" className="w-[26%]" />
            )}
            {axis.columns.map((col) => (
              <th key={col.id} scope="col" className="text-left align-bottom font-semibold text-foreground">
                {axis.columnLabel ? `${axis.columnLabel} ${col.label}` : col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {axis.rows.map((row) => (
            <tr key={row.id}>
              <th scope="row" className="text-left align-top font-semibold text-foreground">
                {row.label}
              </th>
              {axis.columns.map((col) => {
                const here = placed.filter((p) => p.cell?.row === row.id && p.cell.column === col.id);
                return (
                  <td key={col.id} className="min-w-0 rounded-md border border-border/70 bg-background/50 p-1.5 align-top">
                    {here.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {here.map(({ card }) => {
                          const verdict = showVerdicts ? gradeAnswer(card, answers[card.id]) ?? "wrong" : null;
                          const current = card.id === highlightId;
                          return (
                            <li key={card.id} className={cn("break-words rounded px-1", current && "bg-cyan-500/15 ring-1 ring-cyan-500")}>
                              {verdict ? (
                                <span className={verdictTone[verdict]}>
                                  <span aria-hidden>{verdictGlyph[verdict]} </span>
                                  <span className="sr-only">{verdictSr[verdict]}</span>
                                </span>
                              ) : null}
                              {current ? (
                                <span>
                                  <span aria-hidden>▶ </span>
                                  <span className="sr-only">this card: </span>
                                </span>
                              ) : null}
                              {card.short ?? card.prompt}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {axis.note ? <p className="text-xs text-muted-foreground">{axis.note}</p> : null}
    </figure>
  );
}

/* ------------------------------------------------------------------------- */
/* The drill                                                                  */
/* ------------------------------------------------------------------------- */

type FocusTarget = "prompt" | "followup" | "verdict" | "score";

/** The learner's bin and, when there was one, their step-2 pick. */
function pickParts(card: SorterCard, answer: CardAnswer | undefined): SorterOption[] {
  const pick = optionById(card, answer?.primary);
  const step2 = followUpOptionById(card, answer?.followUp);
  if (!pick) return [];
  return step2 ? [pick, step2] : [pick];
}

/** The best bin, its step 2 when it has one, and the rule behind the better choice. */
function bestPartsAndWhy(card: SorterCard, answer: CardAnswer | undefined): { parts: SorterOption[]; why: string } {
  const pick = optionById(card, answer?.primary);
  const best = pick?.verdict === "correct" ? pick : correctOptions(card)[0];
  const step2 = card.followUp && card.followUp.after === best.id ? bestFollowUp(card) : undefined;
  if (!step2) return { parts: [best], why: best.feedback };
  // The bin was right and only the second step was wrong: explain the step.
  return { parts: [best, step2], why: pick?.id === best.id ? step2.feedback : best.feedback };
}

/**
 * A deck whose bins are a 2 by 2 grid (regression-log) shows its buttons as that
 * grid, row by row in the axis order, so they look like the cells they stand
 * for. Any other deck, or a lesson subset that drops a cell, keeps the deck's
 * order in a flowing grid.
 */
function binLayout(deck: ScenarioDeck, options: SorterOption[]): { options: SorterOption[]; className: string } {
  const flowing = { options, className: "grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]" };
  const axis = deck.axis;
  if (!axis || axis.rows.length !== 2 || axis.columns.length !== 2 || options.length !== 4) return flowing;
  const place = (o: SorterOption) => {
    const cell = axis.cells[o.id];
    return cell ? axis.rows.findIndex((r) => r.id === cell.row) * 2 + axis.columns.findIndex((c) => c.id === cell.column) : -1;
  };
  const slots = options.map(place);
  if (slots.some((i) => i < 0) || new Set(slots).size !== 4) return flowing;
  return { options: [...options].sort((a, b) => place(a) - place(b)), className: "grid grid-cols-2 gap-2" };
}

/** Option labels as chips, so code labels that end in ';' never run into the sentence around them. */
function OptionChips({ parts, testId }: { parts: SorterOption[]; testId: string }) {
  if (parts.length === 0) return <strong className="text-foreground">nothing</strong>;
  return (
    <span data-testid={testId}>
      {parts.map((o, i) => (
        <React.Fragment key={o.id}>
          {i > 0 ? <span> then </span> : null}
          {o.mono ? (
            <code className={cn("break-words rounded border border-border/70 bg-background/70 px-1.5 py-0.5 text-[12.5px] text-foreground", monoText)}>{o.label}</code>
          ) : (
            <strong className="rounded border border-border/70 bg-background/70 px-1.5 py-0.5 text-foreground">{o.label}</strong>
          )}
        </React.Fragment>
      ))}
    </span>
  );
}

function SorterGame({ deck, cardIds, binIds, title, prefix }: { deck: ScenarioDeck; cardIds?: string[]; binIds?: string[]; title?: string; prefix: string }) {
  const copy = resolveCopy(deck);
  const { cards, unknown, unknownBins, unanswerable } = useMemo(() => selectCards(deck, cardIds, binIds), [deck, cardIds, binIds]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, CardAnswer>>({});
  const [finished, setFinished] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ target: FocusTarget; tick: number } | null>(null);
  const promptRef = useRef<HTMLParagraphElement>(null);
  const scoreRef = useRef<HTMLParagraphElement>(null);
  const verdictRef = useRef<HTMLParagraphElement>(null);
  const followUpRef = useRef<HTMLDivElement>(null);
  const followUpLabelId = useId();
  const subjectId = useId();

  useEffect(() => {
    if (!focusRequest) return;
    // The verdict, not the Next button: Next sits below the whole reveal, and focusing it
    // would scroll the verdict out of view. The bins are disabled by then, so Tab from
    // the verdict reaches the "Why not the others?" toggle (when the card has other
    // options) and then Next.
    const target =
      focusRequest.target === "prompt"
        ? promptRef.current
        : focusRequest.target === "score"
          ? scoreRef.current
          : focusRequest.target === "verdict"
            ? verdictRef.current
            : followUpRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
    target?.focus();
  }, [focusRequest]);

  const requestFocus = (target: FocusTarget) => setFocusRequest((r) => ({ target, tick: (r?.tick ?? 0) + 1 }));
  const heading = title ?? deck.title;
  const total = cards.length;
  const tally = tallyAnswers(cards, answers);

  const quoted = (ids: string[]) => ids.map((id) => `"${id}"`).join(", ");
  const problems = [
    unknown.length > 0 ? `no card ${quoted(unknown)} in deck "${deck.id}".` : null,
    unknownBins.length > 0 ? `no bin ${quoted(unknownBins)} in deck "${deck.id}".` : null,
    unanswerable.length > 0 ? `the bins kept hide every correct bin of ${quoted(unanswerable)}, so ${unanswerable.length === 1 ? "it is" : "they are"} left out.` : null,
  ].filter((p): p is string => p !== null);
  const notice =
    problems.length > 0 ? (
      <p role="alert" data-testid={`${prefix}-notice`} className="rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
        Deck data error: {problems.join(" Also, ")}
      </p>
    ) : null;

  if (total === 0) {
    return (
      <VisualFrame label={deck.label} eyebrow={copy.eyebrow} title={heading} fidelity={deck.fidelity}>
        {notice}
      </VisualFrame>
    );
  }

  const restart = () => {
    setAnswers({});
    setCurrent(0);
    setFinished(false);
    requestFocus("prompt");
  };

  if (finished) {
    return (
      <VisualFrame label={deck.label} eyebrow={copy.eyebrow} title={`${heading}: results`} fidelity={deck.fidelity} assumptions={deck.assumptions}>
        {/* No live region here: focus moves to the score, which is read on arrival. */}
        <div className="space-y-4" data-testid={`${prefix}-sorter-summary`}>
          <p ref={scoreRef} tabIndex={-1} className="text-base font-semibold text-foreground focus:outline-none" data-testid={`${prefix}-score`}>
            {fillTemplate(copy.score, { correct: tally.correct, total })}
          </p>
          {tally.partial > 0 ? (
            <p className="text-sm text-amber-800 dark:text-amber-200" data-testid={`${prefix}-partial-count`}>
              {tally.partial} more {tally.partial === 1 ? "was" : "were"} partly correct.
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">{tally.correct === total ? copy.allCorrect : copy.review}</p>
          {deck.axis ? <AxisGrid deck={deck} cards={cards} answers={answers} showVerdicts testId={`${prefix}-split`} /> : null}
          <ol className="space-y-2">
            {cards.map((c) => {
              const answer = answers[c.id];
              const verdict = gradeAnswer(c, answer) ?? "wrong";
              const best = bestPartsAndWhy(c, answer);
              return (
                <li key={c.id} className={cn("rounded-lg border p-3 text-sm", verdictBox[verdict])} data-testid={`${prefix}-summary-${c.id}`}>
                  <p className="font-medium text-foreground">
                    <span aria-hidden>{verdictGlyph[verdict]} </span>
                    <span className="sr-only">{verdictSr[verdict]}</span>
                    {c.prompt}
                    {c.code ? <span className={cn("ml-1 break-words", monoText)}>{c.short ?? c.code}</span> : null}
                  </p>
                  <p className="mt-1 leading-7 text-muted-foreground">
                    <span>You chose </span>
                    <OptionChips parts={pickParts(c, answer)} testId={`${prefix}-summary-${c.id}-pick`} />
                    {verdict === "correct" ? null : (
                      <>
                        <span> · best is </span>
                        <OptionChips parts={best.parts} testId={`${prefix}-summary-${c.id}-best`} />
                      </>
                    )}
                  </p>
                  {verdict === "correct" ? null : <p className="mt-1 text-muted-foreground">{best.why}</p>}
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            onClick={restart}
            data-testid={`${prefix}-restart`}
            className="min-h-10 rounded-lg border border-border/70 px-4 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copy.restart}
          </button>
        </div>
      </VisualFrame>
    );
  }

  const card = cards[current];
  const answer = answers[card.id] ?? {};
  const primary = optionById(card, answer.primary);
  const step2Open = followUpApplies(card, answer.primary);
  const complete = isAnswerComplete(card, answer);
  const verdict = gradeAnswer(card, answer);
  const bests = correctOptions(card);
  const chosenStep2 = followUpOptionById(card, answer.followUp);
  const bestStep2 = bestFollowUp(card);
  const revealed = Boolean(complete && primary && verdict);
  // The right second step is named whenever the learner did not reach it: a wrong
  // step 2, or a primary pick other than the bin the step belongs to.
  const showBestStep2 = Boolean(
    bestStep2 && card.followUp && (chosenStep2 ? chosenStep2.verdict !== "correct" : primary?.verdict !== "correct" && bests.some((b) => b.id === card.followUp?.after)),
  );
  const isLast = current === total - 1;
  const lead = verdict === "correct" ? copy.correctLead : verdict === "partial" ? copy.partialLead : copy.wrongLead;
  const answeredSoFar = cards.filter((c) => c.id === card.id || isAnswerComplete(c, answers[c.id]));
  const layout = binLayout(deck, card.options);

  const commitPrimary = (id: string) => {
    if (answer.primary) return;
    setAnswers((a) => ({ ...a, [card.id]: { primary: id } }));
    requestFocus(followUpApplies(card, id) ? "followup" : "verdict");
  };
  const commitStep2 = (id: string) => {
    if (answer.followUp) return;
    setAnswers((a) => ({ ...a, [card.id]: { ...a[card.id], followUp: id } }));
    requestFocus("verdict");
  };
  const next = () => {
    if (isLast) {
      setFinished(true);
      requestFocus("score");
    } else {
      setCurrent((c) => c + 1);
      requestFocus("prompt");
    }
  };

  return (
    <VisualFrame
      label={deck.label}
      eyebrow={`${copy.eyebrow} · ${copy.itemNoun} ${current + 1} of ${total}`}
      title={heading}
      summary={deck.summary}
      fidelity={deck.fidelity}
      assumptions={deck.assumptions}
    >
      <div className="space-y-4" data-testid={`${prefix}-sorter-game`}>
        {notice}
        {/* The prompt takes focus on each new card; its subject (the name, statement or log) is its description. */}
        <p
          ref={promptRef}
          tabIndex={-1}
          aria-describedby={card.code || card.log ? subjectId : undefined}
          className="text-base font-medium text-foreground focus:outline-none"
          data-testid={`${prefix}-sorter-prompt`}
        >
          {card.prompt}
        </p>
        {card.code ? <CodeBlock code={card.code} label={card.codeLabel} id={subjectId} /> : null}
        {card.log ? <LogBlock lines={card.log} label={card.codeLabel} revealed={complete} testId={`${prefix}-log`} id={subjectId} /> : null}

        {answer.primary ? null : (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid={`${prefix}-predict`}>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Predict</span>
            <span>{copy.predictHint}</span>
          </p>
        )}
        <div className={layout.className} role="group" aria-label={copy.groupLabel} data-testid={`${prefix}-bins`}>
          {layout.options.map((option) => (
            <ChoiceButton
              key={option.id}
              option={option}
              testId={`${prefix}-option-${option.id}`}
              chosen={answer.primary === option.id}
              locked={Boolean(answer.primary)}
              revealed={complete}
              copy={copy}
              onPick={() => commitPrimary(option.id)}
            />
          ))}
        </div>

        {step2Open && card.followUp ? (
          <div ref={followUpRef} role="group" aria-labelledby={followUpLabelId} className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3" data-testid={`${prefix}-followup`}>
            <p id={followUpLabelId} className="mb-2 text-sm font-semibold text-foreground">
              <span className="mr-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Step 2</span>
              {card.followUp.question}
            </p>
            <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
              {card.followUp.options.map((option) => (
                <ChoiceButton
                  key={option.id}
                  option={option}
                  testId={`${prefix}-followup-${option.id}`}
                  chosen={answer.followUp === option.id}
                  locked={Boolean(answer.followUp)}
                  revealed={complete}
                  copy={copy}
                  onPick={() => commitStep2(option.id)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/*
          Only the step-2 notice sits in the live region. The verdict is not live: focus
          moves to it, so it is read on arrival, and the pictures, tables and code of
          the reveal after it are read on demand.
        */}
        <div
          data-testid={revealed ? `${prefix}-sorter-feedback` : undefined}
          className={cn(revealed && "space-y-2 rounded-xl border border-border/70 bg-background/50 p-3 text-sm")}
        >
          {/* Empty once the card is revealed; hidden then so it adds no gap above the verdict. */}
          <div aria-live="polite" hidden={revealed} data-testid={`${prefix}-live`}>
            {step2Open && !complete && primary ? (
              <p className="text-sm text-muted-foreground" data-testid={`${prefix}-locked`}>
                Locked in: <strong className="text-foreground">{primary.label}</strong>. Answer step 2 to see the result.
              </p>
            ) : null}
          </div>
          {revealed && primary && verdict ? (
            <p ref={verdictRef} tabIndex={-1} className={cn(verdictTone[verdict], "focus:outline-none")} data-testid={`${prefix}-verdict`}>
              <strong>{lead}</strong>
              {primary.feedback}
            </p>
          ) : null}
          {revealed && primary && verdict ? (
            <>
              {chosenStep2 ? <Step2Line lead="Your step 2" option={chosenStep2} className={verdictTone[chosenStep2.verdict]} /> : null}
              {primary.verdict !== "correct"
                ? bests.map((b, i) => (
                    <p key={b.id} className="text-muted-foreground">
                      <strong className="text-foreground">{fillTemplate(i === 0 ? copy.bestLead : copy.alsoLead, { label: b.label })}</strong>
                      {b.feedback}
                    </p>
                  ))
                : bests
                    .filter((b) => b.id !== primary.id)
                    .map((b) => (
                      <p key={b.id} className="text-muted-foreground">
                        <strong className="text-foreground">{fillTemplate(copy.alsoLead, { label: b.label })}</strong>
                        {b.feedback}
                      </p>
                    ))}
              {showBestStep2 && bestStep2 ? <Step2Line lead="Best step 2" option={bestStep2} className="text-muted-foreground" /> : null}
              {card.caveat ? (
                <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-100" data-testid={`${prefix}-caveat`}>
                  <span aria-hidden>⚠ </span>
                  {card.caveat}
                </p>
              ) : null}
              {card.definedIn ? (
                <p className="text-foreground" data-testid={`${prefix}-defined-in`}>
                  <strong>Defined in: </strong>
                  {card.definedIn}
                </p>
              ) : null}
              {card.anchor ? <AnchorFigure id={card.anchor} testId={`${prefix}-anchor`} note={card.anchorNote} /> : null}
              {card.stack ? <CompileStack deck={deck} card={card} testId={`${prefix}-stack`} /> : null}
              {deck.axis ? <AxisGrid deck={deck} cards={answeredSoFar} answers={answers} highlightId={card.id} testId={`${prefix}-grid`} /> : null}
              {card.answerCode ? (
                <pre className={codePanel}>
                  <code>{card.answerCode}</code>
                </pre>
              ) : null}
              <p className="text-xs text-muted-foreground" data-testid={`${prefix}-source`}>
                Source: {card.source.map(formatSource).join("; ")}
              </p>
              <OtherOptions key={card.id} card={card} answer={answer} copy={copy} testId={`${prefix}-others`} />
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" data-testid={`${prefix}-progress`}>
            {fillTemplate(copy.progress, { correct: tally.correct, answered: tally.answered })}
            {tally.partial > 0 ? ` · ${tally.partial} partly correct` : ""}
          </p>
          <button
            type="button"
            data-testid={`${prefix}-next`}
            disabled={!complete}
            onClick={next}
            className="min-h-10 rounded-lg bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLast ? copy.finish : copy.next}
          </button>
        </div>
      </div>
    </VisualFrame>
  );
}

/**
 * One data-driven classification drill: commit a bin (the prediction), then
 * every option explains itself: the pick and the best choice in the reveal, the
 * rest under "Why not the others?". Decks live in src/lib/scenario-sorter-decks.ts.
 */
export default function ScenarioSorter({ deck, cards, bins, title, testIdPrefix = "sorter" }: ScenarioSorterProps) {
  const data = getScenarioDeck(deck);
  if (!data) {
    return (
      <p role="alert" data-testid={`${testIdPrefix}-notice`} className="not-prose my-6 rounded-lg border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
        ScenarioSorter: unknown deck "{String(deck)}".
      </p>
    );
  }
  return <SorterGame key={`${deck}:${(cards ?? []).join(",")}:${(bins ?? []).join(",")}`} deck={data} cardIds={cards} binIds={bins} title={title} prefix={testIdPrefix} />;
}

export { ScenarioSorter };
