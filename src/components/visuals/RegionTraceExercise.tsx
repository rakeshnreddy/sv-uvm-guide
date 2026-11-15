"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { CodeTrace, type CodeTraceLine } from "@/components/visual-system/CodeTrace";
import { OutcomeGroups } from "@/components/visual-system/OutcomeGroups";
import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { ReorderList } from "@/components/visual-system/ReorderList";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { ValueChip } from "@/components/visual-system/ValueChip";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { RegionLadder } from "@/components/visuals/scheduler/RegionLadder";
import {
  KATA_LINE_IDS,
  KATA_PRINTS,
  REGION_TRACE_ASSUMPTIONS,
  SLOT_LABEL,
  WORKED_CHANGES,
  WORKED_PRINTS,
  WORKED_VARIANT_LABELS,
  WORKED_VARIANT_STEPS,
  gradeKata,
  gradeLogOrder,
  kataKey,
  kataLineCode,
  kataListing,
  kataLog,
  kataOrderReason,
  kataSampledOptions,
  legalOrdersText,
  listingExcerpt,
  logOrderKey,
  outcomeCards,
  regionsText,
  startingChipOrder,
  traceRowSummary,
  variantOptions,
  variantOutcomeText,
  workedExampleListing,
  workedExampleScenario,
  workedLessonPrintOrder,
  workedTraceRows,
  type KataGrade,
  type KataLineId,
  type ListingLine,
  type OrderGrade,
  type PrintChip,
  type RegionTracePresetId,
  type WorkedVariant,
} from "@/lib/sv-region-trace-exercises";
import { REGION_LABELS, REGION_ORDER, formatPrintValue, type RegionId, type SvValue } from "@/lib/sv-scheduler-model";
import { cn } from "@/lib/utils";

export interface RegionTraceExerciseProps {
  /** One preset per lesson use: the F3B worked example, or the F3B kata. */
  preset?: RegionTracePresetId;
}

const mono = "font-mono [font-variant-ligatures:none]";
const panel = "rounded-xl border border-border bg-card p-3";
const secondaryButton =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const primaryButton =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
const textButton =
  "inline-flex min-h-10 items-center rounded-md px-2 text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
/** The shared primitives size some buttons below 40 px (segments): size them for touch from here. */
const touchButtons = "[@media(pointer:coarse)]:[&_button]:min-h-10";
/** The frame's "Assumptions and limits" disclosure: a 40 px target on touch screens. */
const frameClass = "[@media(pointer:coarse)]:[&_summary]:min-h-10 [@media(pointer:coarse)]:[&_summary]:py-3";
const sectionTitle = "text-base font-semibold text-foreground";
/** A feedback block that takes focus after a check, so keyboard users land on the result. */
const focusTargetClass = "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Moves focus after a check, a reveal or a restart: the button sets where
 * focus goes, and the effect moves it once the new view has rendered.
 */
function useFocusAfter(trigger: unknown) {
  const resultRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<"result" | "check" | null>(null);
  useEffect(() => {
    const target = pending.current === "result" ? resultRef.current : pending.current === "check" ? checkRef.current : null;
    pending.current = null;
    target?.focus();
  }, [trigger]);
  return { resultRef, checkRef, focusNext: (target: "result" | "check") => (pending.current = target) };
}

/** One persistent polite live region, mounted from the first render so its first message is announced. */
function LiveAnnouncement({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only" data-testid="trace-live">
      {text}
    </p>
  );
}

const toCodeLines = (lines: ListingLine[]): CodeTraceLine[] => lines.map((l) => ({ text: l.text, key: l.key, owner: l.owner }));

function Listing({ lines, label, activeKey, contextKeys, className }: { lines: ListingLine[]; label: string; activeKey?: string; contextKeys?: string[]; className?: string }) {
  const changed = new Set(lines.filter((l) => l.changed).map((l) => l.key));
  return (
    <CodeTrace
      lines={toCodeLines(lines)}
      label={label}
      className={className}
      activeKey={activeKey}
      contextKeys={contextKeys}
      renderLineControl={(line) =>
        line.key && changed.has(line.key) ? (
          <span className="rounded border border-code-border px-1.5 font-sans text-xs text-code-foreground">
            <span aria-hidden>✎ </span>changed
          </span>
        ) : null
      }
    />
  );
}

function LogPanel({ lines, label }: { lines: string[]; label: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-code-surface text-code-foreground">
      <figcaption className="border-b border-code-border px-3 py-2 text-label text-code-muted">{label}</figcaption>
      <pre role="region" tabIndex={0} aria-label={label} className={cn("overflow-x-auto whitespace-pre-wrap break-words p-3 text-xs leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", mono)}>
        {lines.length ? lines.join("\n") : <span className="text-code-muted">Nothing printed yet.</span>}
      </pre>
    </figure>
  );
}

function Verdict({ correct, children }: { correct: boolean; children: React.ReactNode }) {
  return (
    <p className={cn("text-sm", correct ? "text-success" : "text-danger")}>
      <span aria-hidden>{correct ? "✓ " : "✕ "}</span>
      {children}
    </p>
  );
}

const chipItems = (prints: readonly PrintChip[]) => prints.map((p) => ({ id: p.id, label: p.name, description: p.source }));

// ---------------------------------------------------------------------------
// Worked example
// ---------------------------------------------------------------------------

function TraceScrubber({ onAnnounce }: { onAnnounce: (text: string) => void }) {
  const uid = useId();
  const rows = useMemo(() => workedTraceRows(), []);
  const [index, setIndex] = useState(0);
  const row = rows[index];
  const previous = index > 0 ? rows[index - 1] : undefined;
  const logSoFar = rows.slice(0, index + 1).flatMap((r) => r.prints);
  /** The buttons announce the new row; the slider does not, because its aria-valuetext already reads it. */
  const go = (next: number, announce: boolean) => {
    const clamped = Math.max(0, Math.min(rows.length - 1, next));
    setIndex(clamped);
    if (announce) onAnnounce(traceRowSummary(rows[clamped]));
  };
  const listing = useMemo(() => workedExampleListing(), []);
  const excerpt = useMemo(() => listingExcerpt(listing, row.codeKey, row.contextKeys), [listing, row]);
  return (
    <section aria-labelledby={`${uid}-rte-trace-title`} className="space-y-3">
      <h4 id={`${uid}-rte-trace-title`} className={sectionTitle}>
        2. Step through the slot
      </h4>
      <p className="text-sm text-muted-foreground">
        Every step is at {SLOT_LABEL}; only the region changes. The code line, the region and the log move together. This run takes always_ff before the initial and the program thread before the pass action, as the lesson&apos;s table does.
      </p>
      <div className={cn(panel, "space-y-3")}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={secondaryButton} onClick={() => go(index - 1, true)} disabled={index === 0}>
            Previous step
          </button>
          <button type="button" className={secondaryButton} onClick={() => go(index + 1, true)} disabled={index === rows.length - 1}>
            Next step
          </button>
          <span className={cn("ml-auto text-xs tabular-nums text-muted-foreground", mono)} aria-hidden>
            step {row.step} of {rows[rows.length - 1].step}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={rows.length - 1}
          value={index}
          onChange={(e) => go(Number(e.target.value), false)}
          aria-label="Trace step"
          aria-valuetext={traceRowSummary(row)}
          className="h-10 w-full cursor-pointer accent-primary"
        />
        <div className="rounded-lg border border-border bg-muted p-3">
          <p className="text-sm font-medium text-foreground">
            Step {row.step}: {REGION_LABELS[row.region]}
          </p>
          <p className="mt-1 text-sm text-foreground">{row.what}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>After it:</span>
            <ValueChip name="q" value={row.q} changed={previous !== undefined && previous.q !== row.q} />
            <ValueChip name="y" value={row.y} changed={previous !== undefined && previous.y !== row.y} />
          </div>
          {row.prints.length ? <p className={cn("mt-2 whitespace-pre-wrap text-xs text-foreground", mono)}>Prints {row.prints.join(", ")}</p> : null}
          {/* Narrow screens: only the lines this step points at; the full listing is above. */}
          <ol className={cn("mt-2 space-y-1 rounded-md border border-code-border bg-code-surface p-2 text-xs leading-5 text-code-foreground lg:hidden", mono)} aria-label="Code for this step" data-testid="step-excerpt">
            {excerpt.map((l) => (
              <li key={l.number} className={cn("flex gap-2 border-l-2 pl-1.5", l.active ? "border-primary" : "border-transparent")}>
                <span className="w-6 shrink-0 text-right text-code-muted" aria-hidden>
                  {l.number}
                </span>
                <code className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                  <span className="sr-only">{`Line ${l.number}${l.active ? ", executing" : ""}: `}</span>
                  {l.text}
                </code>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        {/* Wide screens: the whole listing beside the ladder. Below lg the excerpt above stands in for it. */}
        <Listing lines={listing} label="tb_top.sv, with the current step's line marked" activeKey={row.codeKey} contextKeys={row.contextKeys} className="hidden lg:block" />
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border bg-card p-2">
            <RegionLadder currentRegion={row.region} title={`${SLOT_LABEL}, trace step ${row.step}`} />
          </div>
          <LogPanel lines={logSoFar} label="Log so far" />
        </div>
      </div>
    </section>
  );
}

function VariantExplorer() {
  const uid = useId();
  const [variant, setVariant] = useState<Exclude<WorkedVariant, "as-written">>(WORKED_CHANGES[0]);
  const options: PredictionOption[] = useMemo(() => variantOptions(variant).map((o) => ({ id: o.id, label: o.label, correct: o.correct, feedback: o.feedback })), [variant]);
  const listing = useMemo(() => workedExampleListing(variant), [variant]);
  const outcome = useMemo(() => outcomeCards(workedExampleScenario(variant), WORKED_PRINTS), [variant]);
  const summary = useMemo(() => variantOutcomeText(variant), [variant]);
  return (
    <section aria-labelledby={`${uid}-rte-variants-title`} className="space-y-3">
      <h4 id={`${uid}-rte-variants-title`} className={sectionTitle}>
        4. Change one line, predict again
      </h4>
      <SegmentedControl
        label="Change to try"
        className={touchButtons}
        mono
        value={variant}
        onChange={setVariant}
        options={WORKED_CHANGES.map((v) => ({ value: v, label: WORKED_VARIANT_LABELS[v] }))}
      />
      <p className="text-sm text-muted-foreground">{WORKED_VARIANT_STEPS[variant]}.</p>
      <Listing lines={listing} label={`tb_top.sv with the change: ${WORKED_VARIANT_LABELS[variant]}`} />
      <PredictionPrompt question="Which lines survive?" options={options} resetKey={variant} className={touchButtons}>
        <div className="space-y-3">
          <p className="text-sm text-foreground" data-testid="variant-outcome">
            {summary}
          </p>
          <OutcomeGroups
            groups={outcome.cards}
            runCount={outcome.runCount}
            nondeterminism="region-order"
            label={`Outcomes with the change: ${WORKED_VARIANT_LABELS[variant]}`}
          />
        </div>
      </PredictionPrompt>
    </section>
  );
}

function WorkedExercise() {
  const uid = useId();
  const key = useMemo(() => logOrderKey(workedExampleScenario()), []);
  const legal = key.legal;
  const start = useMemo(() => startingChipOrder(WORKED_PRINTS, legal), [legal]);
  /** The legal order the trace table follows, shown in the locked list when the learner reveals without predicting. */
  const lessonOrder = useMemo(() => {
    const traced = workedLessonPrintOrder();
    return legal.find((l) => l.join() === traced.join()) ?? legal[0];
  }, [legal]);
  const legalText = useMemo(() => legalOrdersText(legal, WORKED_PRINTS), [legal]);
  const listing = useMemo(() => workedExampleListing(), []);
  const asWritten = useMemo(() => outcomeCards(workedExampleScenario(), WORKED_PRINTS), []);
  const [order, setOrder] = useState<string[]>(start);
  const [grade, setGrade] = useState<OrderGrade | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const { resultRef, checkRef, focusNext } = useFocusAfter(revealed);

  const check = () => {
    const g = gradeLogOrder(order, key, WORKED_PRINTS);
    setGrade(g);
    setRevealed(true);
    setAnnouncement(g.feedback);
    focusNext("result");
  };
  const skip = () => {
    setOrder(lessonOrder);
    setRevealed(true);
    setAnnouncement(`Revealed. ${legalText}`);
    focusNext("result");
  };
  const restart = () => {
    setOrder(start);
    setGrade(null);
    setRevealed(false);
    setAnnouncement("Started over. Order the five lines again.");
    focusNext("check");
  };

  return (
    <VisualFrame
      label="Worked example: one time slot, region by region"
      eyebrow="Experiment"
      title="Predict the log, then trace the slot"
      summary={`Five lines print at ${SLOT_LABEL} from four regions. Order them, step through the eleven trace steps, then change one line at a time and predict again.`}
      fidelity="model"
      assumptions={[...REGION_TRACE_ASSUMPTIONS]}
      className={frameClass}
    >
      <LiveAnnouncement text={announcement} />
      <Listing lines={listing} label="tb_top.sv, the worked example" />

      <section aria-labelledby={`${uid}-rte-order-title`} className="space-y-3">
        <h4 id={`${uid}-rte-order-title`} className={sectionTitle}>
          1. Order the five lines
        </h4>
        <p className="text-sm text-muted-foreground">Put the lines in the order they print. If two may print either way round, either order of that pair counts.</p>
        <ReorderList
          items={chipItems(WORKED_PRINTS)}
          order={order}
          onChange={setOrder}
          label="Order the printed lines"
          mono
          disabled={revealed}
          marks={grade ? grade.marks : undefined}
        />
        {!revealed ? (
          <div className="flex flex-wrap items-center gap-3">
            <button ref={checkRef} type="button" className={primaryButton} onClick={check}>
              Check my order
            </button>
            <button type="button" className={textButton} onClick={skip}>
              Reveal without predicting
            </button>
          </div>
        ) : (
          <div ref={resultRef} tabIndex={-1} className={cn("space-y-3", focusTargetClass)} data-testid="order-feedback">
            {grade ? (
              <Verdict correct={grade.correct}>{grade.feedback}</Verdict>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Revealed without a prediction. The list above now shows the order the trace below follows.</p>
                <p className="text-sm text-foreground" data-testid="order-answer">
                  {legalText}
                </p>
              </>
            )}
            <p className="text-sm text-foreground">
              REACT and ACTION both run in Reactive, and §4.7 lets the simulator take events ready there in any order, so either may print first.
            </p>
            <button type="button" className={secondaryButton} onClick={restart}>
              Start over
            </button>
          </div>
        )}
      </section>

      {revealed ? (
        <>
          <TraceScrubber onAnnounce={setAnnouncement} />
          <section aria-labelledby={`${uid}-rte-orders-title`} className="space-y-3">
            <h4 id={`${uid}-rte-orders-title`} className={sectionTitle}>
              3. Every order of the ready processes
            </h4>
            <OutcomeGroups
              groups={asWritten.cards}
              runCount={asWritten.runCount}
              nondeterminism="region-order"
              label="Outcomes of the worked example"
              note="Each group also counts both orders of always_ff and the initial in Active (trace steps 2 and 3), which print the same lines."
            />
          </section>
          <VariantExplorer />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">The trace, every legal order and the three changes open once you check your order or reveal it.</p>
      )}
    </VisualFrame>
  );
}

// ---------------------------------------------------------------------------
// Kata
// ---------------------------------------------------------------------------

type RegionPicks = Partial<Record<KataLineId, RegionId[]>>;

function RegionPicker({ lineId, code, picks, onToggle, disabled, grade }: { lineId: KataLineId; code: string[]; picks: RegionId[]; onToggle: (r: RegionId) => void; disabled: boolean; grade?: KataGrade["lines"][number] }) {
  return (
    <fieldset className="rounded-lg border border-border bg-muted p-3" disabled={disabled}>
      {/* float + w-full keeps the legend inside the bordered box; it names the group "L1: <code>". */}
      <legend className="float-left w-full">
        <span className="block text-sm font-medium text-foreground">
          {`${lineId}:`}
        </span>{" "}
        {code.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 ? " " : null}
            <span className={cn("mt-0.5 block break-words text-xs text-muted-foreground", mono)}>{c}</span>
          </React.Fragment>
        ))}
      </legend>
      <div className="clear-both flex flex-wrap gap-1.5 pt-2">
        {REGION_ORDER.map((r) => {
          const on = picks.includes(r);
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(r)}
              className={cn(
                "inline-flex min-h-10 sm:min-h-9 items-center rounded-md border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed motion-reduce:transition-none [@media(pointer:coarse)]:min-h-10",
                on ? "border-primary border-l-2 bg-card font-medium text-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              {on ? <span aria-hidden className="mr-1">✓</span> : null}
              {REGION_LABELS[r]}
            </button>
          );
        })}
      </div>
      {grade ? (
        <div className="mt-2 space-y-1" data-testid={`kata-verdict-${lineId}`}>
          <Verdict correct={grade.correct}>{grade.correct ? "Correct." : `You picked ${grade.given.length ? regionsText(grade.given) : "no region"}.`}</Verdict>
          <p className="text-sm text-foreground">{grade.explanation}</p>
        </div>
      ) : null}
    </fieldset>
  );
}

function SampledToggle() {
  const uid = useId();
  const sampledLog = useMemo(() => kataLog(true), []);
  const sampledListing = useMemo(() => kataListing(true), []);
  const options: PredictionOption[] = useMemo(() => kataSampledOptions().map((o) => ({ id: o.id, label: o.label, correct: o.correct, feedback: o.feedback })), []);
  return (
    <section aria-labelledby={`${uid}-rte-sampled-title`} className="space-y-3">
      <h4 id={`${uid}-rte-sampled-title`} className={sectionTitle}>
        Requirement 4: print $sampled(y) on L6
      </h4>
      <Listing lines={sampledListing} label="The kata with $sampled(y) on L6" />
      <PredictionPrompt question="What does the D line print now?" options={options} className={touchButtons}>
        <LogPanel lines={sampledLog} label="Log with $sampled(y), from the model" />
      </PredictionPrompt>
    </section>
  );
}

function KataExercise() {
  const uid = useId();
  /** The model's answers, computed once and reused by every check. */
  const key = useMemo(() => kataKey(), []);
  const legal = key.order.legal;
  const start = useMemo(() => startingChipOrder(KATA_PRINTS, legal), [legal]);
  const listing = useMemo(() => kataListing(), []);
  const code = useMemo(() => Object.fromEntries(KATA_LINE_IDS.map((id) => [id, kataLineCode(id)])) as Record<KataLineId, string[]>, []);
  const log = useMemo(() => kataLog(), []);
  const orderReason = useMemo(() => kataOrderReason(), []);
  const [picks, setPicks] = useState<RegionPicks>({});
  const [order, setOrder] = useState<string[]>(start);
  const [dValue, setDValue] = useState<SvValue | null>(null);
  const [grade, setGrade] = useState<KataGrade | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const dGroup = useId();
  const { resultRef, checkRef, focusNext } = useFocusAfter(grade);

  const toggle = (id: KataLineId, r: RegionId) =>
    setPicks((p) => {
      const current = p[id] ?? [];
      return { ...p, [id]: current.includes(r) ? current.filter((x) => x !== r) : [...current, r] };
    });
  const check = () => {
    const g = gradeKata({ regions: picks, order, dValue }, false, key);
    setGrade(g);
    setAnnouncement(`${g.score} of ${g.total} right. ${g.order.feedback} ${g.dFeedback}`);
    focusNext("result");
  };
  const restart = () => {
    setPicks({});
    setOrder(start);
    setDValue(null);
    setGrade(null);
    setAnnouncement("Started over.");
    focusNext("check");
  };
  const done = grade !== null;
  const dOptions: SvValue[] = [0, 1];

  return (
    <VisualFrame
      label="Kata: label the region"
      eyebrow="Practice"
      title="Label every line's region, then order the log"
      summary={`For the first rising edge, ${SLOT_LABEL}: pick the regions where each line reads, writes or prints, order the four printed lines, and say what D prints.`}
      fidelity="model"
      assumptions={[...REGION_TRACE_ASSUMPTIONS]}
      className={frameClass}
    >
      <LiveAnnouncement text={announcement} />
      <Listing lines={listing} label="The kata snippet" />

      <section aria-labelledby={`${uid}-rte-kata-regions`} className="space-y-2">
        <h4 id={`${uid}-rte-kata-regions`} className={sectionTitle}>
          1. Regions for L1 to L6
        </h4>
        <p className="text-sm text-muted-foreground">For each line, pick every region where it reads, writes or prints.</p>
        {KATA_LINE_IDS.map((id) => (
          <RegionPicker key={id} lineId={id} code={code[id]} picks={picks[id] ?? []} onToggle={(r) => toggle(id, r)} disabled={done} grade={grade?.lines.find((l) => l.id === id)} />
        ))}
      </section>

      <section aria-labelledby={`${uid}-rte-kata-order`} className="space-y-2">
        <h4 id={`${uid}-rte-kata-order`} className={sectionTitle}>
          2. Order the printed lines
        </h4>
        <ReorderList items={chipItems(KATA_PRINTS)} order={order} onChange={setOrder} label="Order the kata's printed lines" mono disabled={done} marks={grade?.order.marks} />
        {grade ? <Verdict correct={grade.order.correct}>{grade.order.feedback}</Verdict> : null}
      </section>

      <fieldset className={cn(panel, "space-y-2")} disabled={done}>
        <legend className={cn(sectionTitle, "px-1")}>3. What value of y does D print?</legend>
        <div className="flex flex-wrap gap-2">
          {dOptions.map((v) => (
            <label key={String(v)} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted px-3 text-sm text-foreground">
              <input type="radio" name={dGroup} value={String(v)} checked={dValue === v} onChange={() => setDValue(v)} className="size-5 accent-primary" />
              <span className={mono}>D y={formatPrintValue(v)}</span>
            </label>
          ))}
        </div>
        {grade ? <Verdict correct={grade.dCorrect}>{grade.dFeedback}</Verdict> : null}
      </fieldset>

      {!done ? (
        <button ref={checkRef} type="button" className={primaryButton} onClick={check}>
          Check my answers
        </button>
      ) : (
        <div className="space-y-3" data-testid="kata-result">
          <div ref={resultRef} tabIndex={-1} className={focusTargetClass} data-testid="kata-score">
            <p className="text-sm font-medium text-foreground">
              {grade.score} of {grade.total} right.
            </p>
          </div>
          <LogPanel lines={log} label="The log, from the model" />
          <p className="text-sm text-foreground">{orderReason}</p>
          <button type="button" className={secondaryButton} onClick={restart}>
            Start over
          </button>
          <SampledToggle />
        </div>
      )}
    </VisualFrame>
  );
}

export default function RegionTraceExercise({ preset = "f3b-worked-example" }: RegionTraceExerciseProps) {
  return preset === "f3b-kata" ? <KataExercise /> : <WorkedExercise />;
}
