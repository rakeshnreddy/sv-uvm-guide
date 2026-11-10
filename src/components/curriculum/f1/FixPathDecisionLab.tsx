"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";

import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { ReorderList, type ReorderItem } from "@/components/visual-system/ReorderList";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import { COST_STAGES } from "@/lib/bug-cost-model";
import {
  CUSTOM_DEFAULT,
  DECIDE_SCENARIOS,
  DELAY_EXCEPTION,
  FIX_LABELS,
  KATA_SCENARIOS,
  LAYER_STATE_LABELS,
  RANKING_START,
  STAGE_DELAYS,
  TREE_BRANCHES,
  TREE_NODES,
  TREE_STEP5,
  allCorrect,
  costExplanation,
  decide,
  escapeLine,
  factLines,
  gradeCostOrder,
  gradeDelayOrder,
  isTapedOut,
  predictionFeedback,
  predictionOptions,
  stageOf,
  type BugFacts,
  type CrossSection,
  type FixDecision,
  type FixScenario,
  type FixShape,
  type LayerState,
  type RankMark,
  type StageId,
  type Timing,
  type TreeStep,
  type WorkaroundPath,
} from "@/lib/fix-path-model";
import { cn } from "@/lib/utils";

export type FixPathMode = "decide" | "kata";

export interface FixPathDecisionLabProps {
  /** "decide" (default): one late bug, predict its fix. "kata": the lesson's four-scenario kata and the two rankings. */
  mode?: FixPathMode;
  /** decide mode: "reset-value" (default), "comparator", "pipeline-stage", "field-corruption" or "custom". */
  preset?: string;
  className?: string;
}

export const FIX_PATH_ASSUMPTIONS = [
  "A conceptual illustration of industry practice. No standard defines ECOs, respins, spare cells or defeature bits; the rules come from this lesson's own tables, worked examples, triage steps and kata, and real projects differ.",
  "Cost multipliers are the lesson's rule of thumb (each later stage about ten times the one before), read from the cost graph's model. They are not data, and no dollar figures or mask counts are shown.",
  "Delays use the lesson's qualitative classes only (days to weeks, weeks, months); real delays are project-dependent.",
  "Spare cells and timing decide only after tape-out. With timing unknown, the answer is the kata's: metal-only if physical design finds a timing-clean fix, otherwise a full respin.",
  "Every metal-only fix must still close timing. The lesson ties the timing risk to long routes to distant spare cells; applying the timing control when the fix fits in nearby cells is this lab's extension of that rule.",
  "Before tape-out only a small fix is modelled: the lesson's pre-tape-out ECO is a small late fix, and a larger change (one that needs new transistors) goes back through synthesis and place-and-route instead.",
  "Workarounds are modelled only after tape-out, for parts that exist. Bugs found in RTL simulation are not modelled: the fix there is an RTL edit and a block rerun.",
  "The lesson's held wafers belong to first silicon. For a metal-only fix to a field bug the lab does not assume wafers are still held.",
  "Escape analysis lines marked \"for example\" (worked-example bugs 1 and 2) are examples drawn from the lesson's other sections; the lesson states the escape analysis only for bug 4 and the kata.",
];

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

/** Mounted only inside a revealed prompt, so the parent knows the answer is on screen. */
function RevealSignal({ onReveal }: { onReveal: () => void }) {
  useEffect(() => {
    onReveal();
  }, [onReveal]);
  return null;
}

const bandHeights = [12, 12, 12, 26];

function bandProps(state: LayerState, hatchId: string): React.SVGProps<SVGRectElement> {
  if (state === "new") return { fill: `url(#${hatchId})`, stroke: "currentColor", strokeWidth: 1.2 };
  if (state === "reused") return { fill: "currentColor", fillOpacity: 0.16, stroke: "currentColor", strokeOpacity: 0.6, strokeWidth: 1 };
  return { fill: "none", stroke: "currentColor", strokeOpacity: 0.75, strokeWidth: 1, strokeDasharray: "4 3" };
}

function describeSection(section: CrossSection): string {
  return `${section.caption}. ${section.layers.map((l) => `${l.label}: ${LAYER_STATE_LABELS[l.state]}`).join("; ")}.`;
}

/** One cross-section in the encoding of the lesson's respin figure: hatched = new mask, solid = reused, dashed = no mask yet. */
function CrossSectionFigure({ section }: { section: CrossSection }) {
  const hatchId = useId().replace(/:/g, "");
  let y = 4;
  return (
    <figure className="space-y-1">
      <figcaption className="text-xs font-semibold text-foreground">{section.caption}</figcaption>
      <svg viewBox="0 0 230 92" role="img" aria-label={describeSection(section)} className="w-full max-w-xs text-foreground">
        <defs>
          <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.55" />
          </pattern>
        </defs>
        {section.layers.map((layer, i) => {
          const h = bandHeights[i];
          const top = y;
          y += h + 3;
          return (
            <g key={layer.id} data-state={layer.state}>
              <text x="4" y={top + h / 2 + 3.5} fontSize="10" fill="currentColor">
                {layer.label}
              </text>
              <rect x="118" y={top} width="104" height={h} rx="2" {...bandProps(layer.state, hatchId)} />
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function Legend() {
  // Several legends can render at once (one per kata scenario), so the pattern id must be unique.
  const base = useId().replace(/:/g, "");
  const swatch = (state: LayerState) => (
    <svg viewBox="0 0 16 12" aria-hidden className="h-3 w-4 shrink-0 text-foreground">
      <defs>
        <pattern id={`${base}-${state}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.55" />
        </pattern>
      </defs>
      <rect x="1" y="1" width="14" height="10" rx="1.5" {...bandProps(state, `${base}-${state}`)} />
    </svg>
  );
  return (
    <ul aria-label="Layer legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {(["new", "reused", "no-mask"] as const).map((state) => (
        <li key={state} className="flex items-center gap-1.5">
          {swatch(state)}
          {state === "new" ? "hatched: " : state === "reused" ? "solid: " : "dashed: "}
          {LAYER_STATE_LABELS[state]}
        </li>
      ))}
    </ul>
  );
}

const answerWord = { yes: "yes", no: "no", depends: "depends", open: "left open" } as const;

/** The lesson's triage tree, steps 2-5, with the path this bug takes highlighted. */
function TriageTree({ tree }: { tree: TreeStep[] }) {
  const byStep = new Map(tree.map((t) => [t.step, t]));
  return (
    <ol aria-label="Triage steps 2 to 5, with the path taken" className="space-y-2">
      {([2, 3, 4] as const).map((step) => {
        const taken = byStep.get(step);
        const branches = TREE_BRANCHES[step];
        return (
          <li
            key={step}
            data-taken={taken ? "true" : "false"}
            className={cn("rounded-xl border p-2.5 text-sm", taken ? "border-cyan-500/60 bg-cyan-500/[0.07]" : "border-dashed border-border/70 opacity-70")}
          >
            <p className="font-semibold text-foreground">
              {TREE_NODES[step].node}
              {taken ? <span className="sr-only"> (on this path)</span> : null}
              {taken?.role === "real-fix" ? <span className="ml-2 text-xs font-normal text-muted-foreground">(the real fix, after the workaround)</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">{TREE_NODES[step].question}</p>
            {taken ? (
              <p className="mt-1 text-sm text-foreground">
                <span className="mr-1.5 rounded bg-cyan-500/20 px-1.5 py-0.5 text-xs font-semibold">{answerWord[taken.answer]}</span>
                <span aria-hidden>→ </span>
                {taken.leadsTo ?? (taken.answer === "yes" ? branches.yes : branches.no)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Not reached on this path.</p>
            )}
          </li>
        );
      })}
      <li className="rounded-xl border border-cyan-500/60 bg-cyan-500/[0.07] p-2.5 text-sm">
        <p className="font-semibold text-foreground">
          {TREE_STEP5.node}
          <span className="sr-only"> (on this path)</span>
        </p>
        <p className="text-xs text-muted-foreground">{TREE_STEP5.question}</p>
      </li>
    </ol>
  );
}

function ResultFacts({ decision, scenario }: { decision: FixDecision; scenario: FixScenario | null }) {
  return (
    <dl className="grid gap-2 text-sm grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
      <div className="rounded-lg border border-border/70 bg-background/50 p-2.5">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Rule-of-thumb cost</dt>
        <dd className="mt-0.5 text-foreground">
          <span className="font-mono font-semibold">{decision.multiplierText}</span> at {decision.stage.label}
        </dd>
      </div>
      <div className="rounded-lg border border-border/70 bg-background/50 p-2.5">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Typical delay (project-dependent)</dt>
        <dd className="mt-0.5 text-foreground">{decision.delay}</dd>
      </div>
      <div className="rounded-lg border border-border/70 bg-background/50 p-2.5">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">What changes</dt>
        <dd className="mt-0.5 text-foreground">{decision.whatChanges}</dd>
      </div>
      {scenario?.detail ? (
        <div className="rounded-lg border border-border/70 bg-background/50 p-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">The fix in detail</dt>
          <dd className="mt-0.5 text-foreground">{scenario.detail}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function DecisionReveal({ facts, scenario, showTree = true }: { facts: BugFacts; scenario: FixScenario | null; showTree?: boolean }) {
  const decision = decide(facts);
  return (
    <div className="space-y-4" data-testid="fix-path-result">
      <p className="text-sm font-semibold text-foreground">{decision.summary}</p>
      <div className={cn("grid gap-4", showTree && decision.tree.length > 0 && "md:grid-cols-2")}>
        <div className="space-y-3">
          {decision.sections.map((section) => (
            <CrossSectionFigure key={section.caption} section={section} />
          ))}
          <Legend />
        </div>
        {showTree && decision.tree.length > 0 ? <TriageTree tree={decision.tree} /> : null}
      </div>
      <ResultFacts decision={decision} scenario={scenario} />
      <p className="text-sm text-foreground">{escapeLine(facts.stage, scenario?.escape ?? null)}</p>
    </div>
  );
}

function optionsFor(facts: BugFacts, mode: FixPathMode): PredictionOption[] {
  return predictionOptions(mode).map((id) => {
    const fb = predictionFeedback(facts, id);
    return { id, label: FIX_LABELS[id], correct: fb.correct, feedback: fb.feedback };
  });
}

/* ------------------------------------------------------------------ */
/* Decide mode                                                         */
/* ------------------------------------------------------------------ */

/** Counts are whole numbers from 0 to 999. */
const COUNT_PATTERN = /^\d{1,3}$/;

/**
 * A count field that keeps a local draft, so the learner can clear it and type
 * a new number. Only a whole number from 0 to 999 is committed; anything else
 * (a minus sign, a decimal point, four digits) is not accepted into the draft,
 * and an empty draft returns to the last committed count on blur.
 */
function CountInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }
  const pending = draft === "";
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-xs text-foreground">
          {label}
        </label>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={999}
          step={1}
          value={draft}
          aria-describedby={hintId}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw !== "" && !COUNT_PATTERN.test(raw)) return;
            setDraft(raw);
            if (raw !== "") onChange(Number.parseInt(raw, 10));
          }}
          onBlur={() => setDraft(String(value))}
          className="h-10 w-20 rounded-lg border border-border/70 bg-background px-2 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <p id={hintId} className="text-[11px] text-muted-foreground">
        {pending ? `Type a whole number from 0 to 999; until then the count stays ${value.toLocaleString("en-US")}.` : "A whole number from 0 to 999."}
      </p>
    </div>
  );
}

const yesNo = [
  { value: "no" as const, label: "No" },
  { value: "yes" as const, label: "Yes" },
];

function CustomControls({ facts, onChange }: { facts: BugFacts; onChange: (f: BugFacts) => void }) {
  const tapedOut = isTapedOut(facts.stage);
  const fix = facts.fix ?? (CUSTOM_DEFAULT.fix as FixShape);
  const counts = typeof fix.spare === "object" ? fix.spare : { gatesNeeded: 0, spareCellsNearby: 0 };
  const setFix = (over: Partial<FixShape>) => onChange({ ...facts, fix: { ...fix, ...over } });
  return (
    <div role="group" aria-label="Facts of your bug" className="space-y-3 rounded-xl border border-border/70 bg-background/40 p-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-foreground">Taped out?</p>
        <SegmentedControl
          label="Taped out?"
          options={yesNo}
          value={tapedOut ? "yes" : "no"}
          onChange={(v) =>
            onChange(
              v === "yes"
                ? { ...facts, stage: "post-silicon" }
                : // Before tape-out only a small fix is modelled (the lesson's pre-tape-out ECO).
                  { ...facts, stage: "system", workaround: "none", fix: { ...fix, needsNewTransistors: false } },
            )
          }
        />
      </div>
      {tapedOut ? (
        <>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">Found at</p>
            <SegmentedControl<StageId>
              label="Found at"
              options={(["post-silicon", "field"] as const).map((id) => ({ value: id, label: stageOf(id).label }))}
              value={facts.stage}
              onChange={(stage) => onChange({ ...facts, stage })}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">Firmware or defeature path</p>
            <SegmentedControl<WorkaroundPath>
              label="Firmware or defeature path"
              options={[
                { value: "none", label: "None" },
                { value: "firmware", label: "Firmware can avoid it" },
                { value: "defeature", label: "Defeature bit" },
              ]}
              value={facts.workaround}
              onChange={(workaround) => onChange({ ...facts, workaround })}
            />
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Found at {stageOf("system").label}, before tape-out. Workaround paths, new transistors, spare cells and timing are modelled only after tape-out, when masks exist. Before tape-out the lab models a small fix; a larger change goes back through synthesis and place-and-route.
        </p>
      )}
      {tapedOut ? (
        <>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">Needs new transistors (a new structure, such as a pipeline stage)?</p>
            <SegmentedControl label="Needs new transistors?" options={yesNo} value={fix.needsNewTransistors ? "yes" : "no"} onChange={(v) => setFix({ needsNewTransistors: v === "yes" })} />
          </div>
          <div className="flex flex-wrap gap-3">
            <CountInput label="Gates needed" value={counts.gatesNeeded} onChange={(gatesNeeded) => setFix({ spare: { ...counts, gatesNeeded } })} />
            <CountInput label="Spare cells nearby" value={counts.spareCellsNearby} onChange={(spareCellsNearby) => setFix({ spare: { ...counts, spareCellsNearby } })} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">More spare cells elsewhere on the die?</p>
            <SegmentedControl label="More spare cells elsewhere on the die?" options={yesNo} value={fix.spareCellsElsewhere ? "yes" : "no"} onChange={(v) => setFix({ spareCellsElsewhere: v === "yes" })} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground">Timing of a metal-only fix</p>
            <SegmentedControl<Timing>
              label="Timing of a metal-only fix"
              options={[
                { value: "closes", label: "Closes" },
                { value: "fails", label: "Fails" },
                { value: "unknown", label: "Unknown" },
              ]}
              value={fix.timing}
              onChange={(timing) => setFix({ timing })}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function DecideMode({ preset }: { preset?: string }) {
  const initial = DECIDE_SCENARIOS.some((s) => s.id === preset) || preset === "custom" ? (preset as string) : DECIDE_SCENARIOS[0].id;
  const [selected, setSelected] = useState(initial);
  const [custom, setCustom] = useState<BugFacts>(CUSTOM_DEFAULT);
  const scenario = DECIDE_SCENARIOS.find((s) => s.id === selected) ?? null;
  const facts = scenario ? scenario.facts : custom;
  const options = useMemo(() => optionsFor(facts, "decide"), [facts]);
  const resetKey = `${selected}:${JSON.stringify(facts)}`;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-foreground">Bug</p>
        <SegmentedControl
          label="Bug"
          options={[...DECIDE_SCENARIOS.map((s) => ({ value: s.id, label: s.short })), { value: "custom", label: "Your own bug" }]}
          value={selected}
          onChange={setSelected}
        />
      </div>
      {scenario ? (
        <p className="rounded-xl border border-border/70 bg-background/40 p-3 text-sm text-foreground">{scenario.prompt}</p>
      ) : (
        <>
          <CustomControls facts={custom} onChange={setCustom} />
          <ul aria-label="Your bug's facts" className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {factLines(custom).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
      <PredictionPrompt question="Which production fix does this bug get?" options={options} resetKey={resetKey}>
        <DecisionReveal facts={facts} scenario={scenario} />
      </PredictionPrompt>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kata mode                                                           */
/* ------------------------------------------------------------------ */

const rankItems: ReorderItem[] = COST_STAGES.map((s) => ({ id: s.id, label: s.label }));

function RankingTask({
  title,
  listLabel,
  grade,
  explanation,
  ungradedNote,
}: {
  title: string;
  listLabel: string;
  grade: (order: StageId[]) => Partial<Record<StageId, RankMark>>;
  explanation: React.ReactNode;
  ungradedNote?: string;
}) {
  const [order, setOrder] = useState<string[]>([...RANKING_START]);
  const [marks, setMarks] = useState<Partial<Record<StageId, RankMark>> | null>(null);
  const graded = marks ? Object.values(marks) : [];
  const right = graded.filter((m) => m === "correct").length;
  const items = marks && ungradedNote ? rankItems.map((i) => (marks[i.id as StageId] ? i : { ...i, description: ungradedNote })) : rankItems;
  return (
    <section aria-label={title} className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <ReorderList items={items} order={order} onChange={setOrder} label={listLabel} marks={marks ?? undefined} disabled={marks !== null} />
      {marks ? (
        <div className="space-y-2 text-sm" aria-live="polite">
          <p className={allCorrect(marks) ? "font-semibold text-emerald-700 dark:text-emerald-300" : "font-semibold text-rose-700 dark:text-rose-300"}>
            {allCorrect(marks) ? `All ${graded.length} graded positions are right.` : `${right} of ${graded.length} graded positions are right.`}
          </p>
          <div className="text-muted-foreground">{explanation}</div>
          <button
            type="button"
            onClick={() => setMarks(null)}
            className="inline-flex h-10 items-center rounded-lg border border-border/70 px-3 text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Reorder again
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMarks(grade(order as StageId[]))}
          className="inline-flex h-10 items-center rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Check this order
        </button>
      )}
    </section>
  );
}

function KataMode() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [committed, setCommitted] = useState<Record<string, boolean>>({});
  const markRevealed = useCallback((id: string) => setRevealed((r) => (r[id] ? r : { ...r, [id]: true })), []);
  const done = KATA_SCENARIOS.filter((s) => revealed[s.id]).length;
  const committedCount = KATA_SCENARIOS.filter((s) => committed[s.id]).length;
  const total = KATA_SCENARIOS.length;

  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        {KATA_SCENARIOS.map((s, i) => (
          <li key={s.id} aria-label={`Scenario ${i + 1}`} className="space-y-2">
            <p className="rounded-xl border border-border/70 bg-background/40 p-3 text-sm text-foreground">
              <span className="font-semibold">{i + 1}. </span>
              {s.prompt}
            </p>
            <PredictionPrompt
              question={`Scenario ${i + 1}: which fix?`}
              options={optionsFor(s.facts, "kata")}
              onCommit={() => setCommitted((c) => (c[s.id] ? c : { ...c, [s.id]: true }))}
            >
              <KataReveal scenario={s} onReveal={markRevealed} />
            </PredictionPrompt>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {done < total
          ? `Commit a fix (or reveal the answer) for every scenario to unlock the ranking: ${done} of ${total} done, ${committedCount} committed.`
          : committedCount === total
            ? `All ${total} fixes committed. Now rank the five stages.`
            : `All ${total} scenarios answered (${committedCount} committed, ${total - committedCount} revealed without a prediction). Now rank the five stages.`}
      </p>
      {done === total ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <RankingTask title="Rank by cost, cheapest first" listLabel="Stages by cost, cheapest first" grade={gradeCostOrder} explanation={<p>{costExplanation()}</p>} />
          <RankingTask
            title="Rank by delay, shortest first"
            listLabel="Stages by delay, shortest first"
            grade={gradeDelayOrder}
            ungradedNote="Not graded: see the exception below."
            explanation={
              <div className="space-y-2">
                <p>{DELAY_EXCEPTION}</p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {COST_STAGES.map((s) => (
                    <li key={s.id}>
                      {s.label}: {STAGE_DELAYS[s.id]}
                    </li>
                  ))}
                </ul>
              </div>
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function KataReveal({ scenario, onReveal }: { scenario: FixScenario; onReveal: (id: string) => void }) {
  const signal = useCallback(() => onReveal(scenario.id), [onReveal, scenario.id]);
  return (
    <>
      <RevealSignal onReveal={signal} />
      <DecisionReveal facts={scenario.facts} scenario={scenario} showTree={false} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Root                                                                */
/* ------------------------------------------------------------------ */

export default function FixPathDecisionLab({ mode = "decide", preset, className }: FixPathDecisionLabProps) {
  const kata = mode === "kata";
  return (
    <VisualFrame
      label={kata ? "Fix path kata: four bugs, one ranking" : "Fix path decision lab: ECO, metal-only respin, full respin or workaround"}
      eyebrow={kata ? "Estimation kata" : "Decision lab"}
      title={kata ? "Four bugs, one ranking" : "Which fix does a late bug get?"}
      summary={
        kata
          ? "Commit a fix for each scenario to see the answer, then rank the five stages by cost and by delay."
          : "Predict the production fix, then see which mask layers change, the triage path, the rule-of-thumb cost and the delay."
      }
      fidelity="illustration"
      assumptions={FIX_PATH_ASSUMPTIONS}
      className={className}
    >
      {kata ? <KataMode /> : <DecideMode preset={preset} />}
    </VisualFrame>
  );
}
