"use client";

import React, { useCallback, useEffect, useId, useMemo, useState } from "react";

import { PredictionPrompt, type PredictionOption } from "@/components/visual-system/PredictionPrompt";
import { ReorderList, type ReorderItem } from "@/components/visual-system/ReorderList";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { FigureDepthDefs, glowFilter, shadowFilter } from "@/components/visual-system/figure-depth";
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

function describeSection(section: CrossSection): string {
  return `${section.caption}. ${section.layers.map((l) => `${l.label}: ${LAYER_STATE_LABELS[l.state]}`).join("; ")}.`;
}

/*
 * The cut block of the lesson's mask-layer figures (DESIGN.md section 14,
 * "Isometric drawings"; F1A's respin and four-decisions figures), to the unit:
 * axes at 30 degrees, a cut face 52 wide under a top 14 deep, the base plate 13
 * thick, metal plates 7 thick and 4 apart, and new masks on a held wafer lifted
 * 5 more. Corners are relative to a plate's top-front corner (0, 0).
 */
/** The lesson's units, drawn 1.3 times larger here, so the stack leads its four labels in a well of its own. */
const S = 1.3;
const u = (n: number) => Math.round(n * S * 10) / 10;
const ISO = { cutX: u(-45), cutY: u(-26), backX: u(12.1), backY: u(-7), farX: u(-32.9), farY: u(-33) } as const;
const BASE_T = u(13);
const METAL_T = u(7);
const PITCH = METAL_T + u(4);
const LIFT = u(5);
/** x of the stack's front corner, y of the base plate's top-front corner, and the drawing's size. */
const STACK_X = 166;
const STACK_Y = 100;
const VIEW_W = 188;
const VIEW_H = 124;

const isoPt = (x: number, y: number, dy = 0) => `${x},${Math.round((y + dy) * 10) / 10}`;
const topFace = [isoPt(0, 0), isoPt(ISO.backX, ISO.backY), isoPt(ISO.farX, ISO.farY), isoPt(ISO.cutX, ISO.cutY)].join(" ");
const cutFace = (t: number) => [isoPt(ISO.cutX, ISO.cutY), isoPt(0, 0), isoPt(0, 0, t), isoPt(ISO.cutX, ISO.cutY, t)].join(" ");
const sideFace = (t: number) => [isoPt(0, 0), isoPt(ISO.backX, ISO.backY), isoPt(ISO.backX, ISO.backY, t), isoPt(0, 0, t)].join(" ");
const silhouette = (t: number) =>
  [isoPt(ISO.cutX, ISO.cutY), isoPt(ISO.farX, ISO.farY), isoPt(ISO.backX, ISO.backY), isoPt(ISO.backX, ISO.backY, t), isoPt(0, 0, t), isoPt(ISO.cutX, ISO.cutY, t)].join(" ");
/** A plate with no mask yet: a dashed wireframe of its outer edges (and the far edges of the topmost one), no fill and no shadow. */
const wireframe = (t: number, topmost: boolean) =>
  `M${ISO.cutX},${ISO.cutY} L0,0 L${ISO.backX},${ISO.backY} M${ISO.cutX},${ISO.cutY + t} L0,${t} L${ISO.backX},${ISO.backY + t} M${ISO.cutX},${ISO.cutY} v${t} M${ISO.backX},${ISO.backY} v${t}` +
  (topmost ? ` M${ISO.cutX},${ISO.cutY} L${ISO.farX},${ISO.farY} L${ISO.backX},${ISO.backY}` : "");

/** One plate, drawn in place (no <use>: rules that reach into a figure through its ancestors, forced colours among them, do not reach a <use> copy). */
function Plate({ state, t, y, topmost, hatch }: { state: LayerState; t: number; y: number; topmost: boolean; hatch: string }) {
  const at = `translate(${STACK_X} ${y})`;
  if (state === "no-mask") {
    return (
      <path
        transform={at}
        d={wireframe(t, topmost)}
        fill="none"
        className="stroke-fig-generic"
        strokeWidth={1.1}
        strokeDasharray="4 3"
        strokeLinejoin="round"
        data-plate={state}
      />
    );
  }
  if (state === "reused") {
    // Solid neutral glass: the silicon that does not change. The top face is a solid mark, so forced colours fill it.
    const s = { stroke: "currentColor", strokeWidth: 1, strokeLinejoin: "round" as const };
    return (
      <g transform={at} className="text-fig-generic" data-plate={state}>
        <polygon points={silhouette(t)} className="fill-card" stroke="none" />
        <polygon points={topFace} className="fig-solid fig-face-top" {...s} />
        <polygon points={cutFace(t)} className="fig-face-left" {...s} />
        <polygon points={sideFace(t)} className="fig-face-right" {...s} />
      </g>
    );
  }
  // A new mask: the fix pays for it, so it takes the cost ramp's step (ramp-4, as in the lesson), hatched on every face.
  const s = { fill: `url(#${hatch})`, stroke: "currentColor", strokeWidth: 1.2, strokeLinejoin: "round" as const };
  return (
    <g transform={at} className="text-fig-ramp-4" data-plate={state}>
      <polygon points={silhouette(t)} className="fill-card" stroke="none" />
      <polygon points={topFace} className="fig-face-top" stroke="none" />
      <polygon points={cutFace(t)} className="fig-face-left" stroke="none" />
      <polygon points={sideFace(t)} className="fig-face-right" stroke="none" />
      <polygon points={topFace} {...s} />
      <polygon points={cutFace(t)} {...s} />
      <polygon points={sideFace(t)} {...s} />
    </g>
  );
}

/** Plate geometry, bottom (base) first: the model lists the layers top first. A new mask on a held wafer lifts clear of it. */
function stackOf(section: CrossSection) {
  const fromBottom = [...section.layers].reverse();
  const lift = fromBottom.some((l) => l.state === "new") && fromBottom.some((l) => l.state === "reused") ? LIFT : 0;
  let y = STACK_Y;
  return fromBottom.map((layer, k) => {
    if (k > 0) y -= PITCH + (fromBottom[k - 1].state !== "new" && layer.state === "new" ? lift : 0);
    return { layer, k, y, t: k === 0 ? BASE_T : METAL_T, topmost: k === fromBottom.length - 1 };
  });
}

/**
 * One cross-section in the encoding of the lesson's mask-layer figures: hatched
 * and lit (ramp-4) = new mask, solid neutral = reused, dashed wireframe = no
 * mask yet. The count of lit plates is what the fix costs, so the new masks are
 * the focal part: they rise and take the soft glow. Each section sits in a well.
 */
function CrossSectionFigure({ section }: { section: CrossSection }) {
  const fx = useId().replace(/:/g, "");
  const hatch = `${fx}-hatch`;
  const stack = stackOf(section);
  const built = stack.some((p) => p.layer.state !== "no-mask");
  const lit = stack.filter((p) => p.layer.state === "new");
  const labelX = STACK_X + ISO.cutX - 13;
  return (
    <figure
      data-lit={lit.length}
      className="space-y-1 rounded-xl border border-[hsl(var(--muted-foreground)/0.55)] bg-[hsl(var(--fig-well))] px-3 pb-2 pt-2.5"
    >
      <figcaption className="text-xs font-semibold text-foreground">{section.caption}</figcaption>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={describeSection(section)} className="mx-auto block w-full max-w-[18rem] text-foreground">
        <defs>
          <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)" className="text-fig-ramp-4">
            <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="1.5" />
          </pattern>
          <FigureDepthDefs id={fx} hues={[]} width={VIEW_W} height={VIEW_H} />
        </defs>
        {/* A stack that exists casts a shadow; a wireframe does not, because no mask exists yet. */}
        {built ? (
          <g aria-hidden className="fig-fx fig-fx-blur" filter={shadowFilter(fx)}>
            <polygon transform={`translate(${STACK_X} ${STACK_Y + BASE_T + 3})`} points={topFace} className="fig-shadow" stroke="none" />
          </g>
        ) : null}
        {lit.length > 0 ? (
          <g aria-hidden className="fig-fx fig-fx-blur fig-glow-soft" filter={glowFilter(fx)}>
            {lit.map((p) => (
              <polygon key={p.layer.id} transform={`translate(${STACK_X} ${p.y})`} points={silhouette(p.t)} className="fill-fig-ramp-4" stroke="none" />
            ))}
          </g>
        ) : null}
        {stack.map((p) => (
          <Plate key={p.layer.id} state={p.layer.state} t={p.t} y={p.y} topmost={p.topmost} hatch={hatch} />
        ))}
        {/* Labels beside the stack on leader lines, top layer first (the model's order), never on a face. */}
        {[...stack].reverse().map((p) => {
          const cy = p.y + ISO.cutY + p.t / 2;
          const isNew = p.layer.state === "new";
          return (
            <g key={p.layer.id} data-state={p.layer.state}>
              <path d={`M${labelX + 3},${cy} H${STACK_X + ISO.cutX - 2}`} fill="none" className="stroke-fig-generic" strokeWidth={1} />
              <text
                x={labelX}
                y={cy + 3.5}
                fontSize="10"
                textAnchor="end"
                fontWeight={isNew ? 600 : undefined}
                className={isNew ? "fill-fig-ramp-text" : undefined}
                fill={isNew ? undefined : "currentColor"}
              >
                {p.layer.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** The layer key as a strip of chips, each with a swatch drawn like its plate. */
function Legend() {
  // Several legends can render at once (one per kata scenario), so the pattern id must be unique.
  const base = useId().replace(/:/g, "");
  const swatch = (state: LayerState) => (
    <svg viewBox="0 0 16 12" aria-hidden className="h-3 w-4 shrink-0 text-foreground">
      {state === "new" ? (
        <>
          <defs>
            <pattern id={`${base}-new`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)" className="text-fig-ramp-4">
              <line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" strokeWidth="1.3" />
            </pattern>
          </defs>
          <g className="text-fig-ramp-4">
            <rect x="1" y="1" width="14" height="10" rx="1.5" className="fig-face-left" stroke="none" />
            <rect x="1" y="1" width="14" height="10" rx="1.5" fill={`url(#${base}-new)`} stroke="currentColor" strokeWidth="1.2" />
          </g>
        </>
      ) : state === "reused" ? (
        <rect x="1" y="1" width="14" height="10" rx="1.5" className="fig-solid fig-face-top text-fig-generic" stroke="currentColor" strokeWidth="1" />
      ) : (
        <rect x="1" y="1" width="14" height="10" rx="1.5" fill="none" className="stroke-fig-generic" strokeWidth="1" strokeDasharray="3 2.4" />
      )}
    </svg>
  );
  return (
    <ul aria-label="Layer legend" className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
      {(["new", "reused", "no-mask"] as const).map((state) => (
        <li key={state} className="fig-chip">
          {swatch(state)}
          <span>
            {state === "new" ? "hatched: " : state === "reused" ? "solid: " : "dashed: "}
            {LAYER_STATE_LABELS[state]}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A step on the path: cyan, the colour of the active path, with a lit top rim like a raised part. */
const TAKEN_STEP_CLASS = "border-cyan-500/60 bg-cyan-500/[0.07] shadow-[inset_0_1px_0_hsl(var(--glass-highlight))]";

/**
 * How the rail leaves a step, down to the next one: "lit" (both steps are on
 * the path), "out" (on the path, but the next step is skipped: the trace turns
 * out of the node column), "around" (a skipped step: the trace passes it outside
 * the node column, and turns back in when "rejoin" is set), "unlit" (a skipped
 * step with no path running past it) or "end" (step 5, where every path ends).
 */
type RailSegment = "lit" | "out" | "around" | "unlit" | "end";

/** The node column's centre is 14 px left of a card, its node 20 px down; the bypass runs at 23 px, outside the nodes. */
const NEUTRAL_RAIL = "absolute -left-[15px] top-[25px] -bottom-[23px] border-l-[1.5px] border-dashed border-fig-generic";

/**
 * The path as a lit trace (decoration, fig-fx): a cyan rail joins the steps the
 * path reaches, from step 2 to step 5, where every path ends. A step the path
 * does not reach keeps a neutral dashed rail and a hollow dashed node, and the
 * lit trace bends out of the node column and goes around it, so the colour
 * never says the path passes a step it skips. The cards' own borders and the
 * "(on this path)" text carry the meaning without it.
 */
function PathMarker({ taken, rail, rejoin = false }: { taken: boolean; rail: RailSegment; rejoin?: boolean }) {
  return (
    <span aria-hidden className="fig-fx" data-rail={rail}>
      {rail === "lit" ? (
        <>
          <span className="absolute -bottom-7 -left-[17px] top-5 w-[6px] bg-fig-cyan/15 dark:bg-fig-cyan/25" />
          <span className="absolute -bottom-7 -left-[15px] top-5 w-0.5 bg-fig-cyan" />
        </>
      ) : null}
      {rail === "out" || rail === "around" || rail === "unlit" ? <span className={NEUTRAL_RAIL} /> : null}
      {rail === "out" ? <span className="absolute -bottom-7 -left-[24px] top-[19px] w-[10px] rounded-tl-md border-l-2 border-t-2 border-fig-cyan" /> : null}
      {rail === "around" ? (
        <span
          className={cn(
            // Offsets count from inside the cards' 1 px border: it starts 3 px above its node to meet the line coming down, and turns in at the next node's centre.
            "absolute -left-[24px] top-[17px] w-[10px] border-l-2 border-fig-cyan",
            rejoin ? "-bottom-[31px] rounded-bl-md border-b-2" : "-bottom-7",
          )}
        />
      ) : null}
      <span
        className={cn(
          "absolute -left-[19px] top-[15px] size-2.5 rounded-full",
          taken ? "bg-fig-cyan shadow-[0_0_0_3px_hsl(var(--fig-cyan)/0.2)]" : "border-[1.5px] border-dashed border-fig-generic",
        )}
      />
    </span>
  );
}

const answerWord = { yes: "yes", no: "no", depends: "depends", open: "left open" } as const;

/** The lesson's triage tree, steps 2-5, with the path this bug takes highlighted. */
function TriageTree({ tree }: { tree: TreeStep[] }) {
  const byStep = new Map(tree.map((t) => [t.step, t]));
  // Step 5 ends every path, so it always counts as reached.
  const reached = (step: number) => step === 5 || byStep.has(step as TreeStep["step"]);
  const steps = [2, 3, 4] as const;
  const railOf = (step: (typeof steps)[number]): RailSegment => {
    const pathRunsPast = steps.some((s) => s < step && reached(s));
    if (reached(step)) return reached(step + 1) ? "lit" : "out";
    return pathRunsPast ? "around" : "unlit";
  };
  return (
    <ol aria-label="Triage steps 2 to 5, with the path taken" className="space-y-2 pl-6">
      {steps.map((step) => {
        const taken = byStep.get(step);
        const branches = TREE_BRANCHES[step];
        return (
          <li
            key={step}
            data-taken={taken ? "true" : "false"}
            // A skipped card fades its words (not its path marks, which keep their 3:1); /50 on the border matches the old /70 at 70% opacity.
            className={cn("relative rounded-xl border p-2.5 text-sm", taken ? TAKEN_STEP_CLASS : "border-dashed border-border/50 [&>p]:opacity-70")}
          >
            <PathMarker taken={Boolean(taken)} rail={railOf(step)} rejoin={reached(step + 1)} />
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
      <li className={cn("relative rounded-xl border p-2.5 text-sm", TAKEN_STEP_CLASS)}>
        <PathMarker taken rail="end" />
        <p className="font-semibold text-foreground">
          {TREE_STEP5.node}
          <span className="sr-only"> (on this path)</span>
        </p>
        <p className="text-xs text-muted-foreground">{TREE_STEP5.question}</p>
      </li>
    </ol>
  );
}

/** The ordered ramp (DESIGN.md section 14): one step per discovery stage, as in the cost chart, beside the stage it names. */
const RAMP_SWATCH = [
  "bg-fig-ramp-1 ring-fig-ramp-1/25",
  "bg-fig-ramp-2 ring-fig-ramp-2/25",
  "bg-fig-ramp-3 ring-fig-ramp-3/25",
  "bg-fig-ramp-4 ring-fig-ramp-4/25",
  "bg-fig-ramp-5 ring-fig-ramp-5/25",
];

function StageSwatch({ stageId }: { stageId: StageId }) {
  const i = Math.max(0, COST_STAGES.findIndex((s) => s.id === stageId));
  return <span aria-hidden data-ramp-step={i + 1} className={cn("h-2.5 w-2.5 flex-none rounded-[3px] border border-transparent ring-[3px]", RAMP_SWATCH[Math.min(i, RAMP_SWATCH.length - 1)])} />;
}

const FACT_CARD_CLASS = "rounded-lg border border-border/70 bg-background/50 p-2.5 shadow-[inset_0_1px_0_hsl(var(--glass-highlight))]";

function ResultFacts({ decision, scenario }: { decision: FixDecision; scenario: FixScenario | null }) {
  return (
    <dl className="grid gap-2 text-sm grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]">
      <div className={FACT_CARD_CLASS}>
        <dt className="text-label text-muted-foreground">Rule-of-thumb cost</dt>
        <dd className="mt-0.5 text-foreground">
          <span className="font-mono font-semibold">{decision.multiplierText}</span> at{" "}
          <span className="ml-0.5 inline-flex items-center gap-1.5">
            <StageSwatch stageId={decision.stage.id} />
            {decision.stage.label}
          </span>
        </dd>
      </div>
      <div className={FACT_CARD_CLASS}>
        <dt className="text-label text-muted-foreground">Typical delay (project-dependent)</dt>
        <dd className="mt-0.5 text-foreground">{decision.delay}</dd>
      </div>
      <div className={FACT_CARD_CLASS}>
        <dt className="text-label text-muted-foreground">What changes</dt>
        <dd className="mt-0.5 text-foreground">{decision.whatChanges}</dd>
      </div>
      {scenario?.detail ? (
        <div className={FACT_CARD_CLASS}>
          <dt className="text-label text-muted-foreground">The fix in detail</dt>
          <dd className="mt-0.5 text-foreground">{scenario.detail}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function DecisionReveal({ facts, scenario, showTree = true }: { facts: BugFacts; scenario: FixScenario | null; showTree?: boolean }) {
  const decision = decide(facts);
  const tree = showTree && decision.tree.length > 0;
  const several = decision.sections.length > 1;
  const sections = (
    <div className="space-y-3">
      <div className={cn("grid gap-3", several ? "grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))]" : "grid-cols-[repeat(auto-fit,minmax(min(100%,13.5rem),1fr))]")}>
        {decision.sections.map((section) => (
          <CrossSectionFigure key={section.caption} section={section} />
        ))}
      </div>
      <Legend />
    </div>
  );
  const factsBlock = <ResultFacts decision={decision} scenario={scenario} />;
  return (
    <div className="space-y-4" data-testid="fix-path-result">
      <p className="text-sm font-semibold text-foreground">{decision.summary}</p>
      {several ? (
        /* Two or three sections sit side by side in a full-width row, as in the lesson's respin figure; the triage path then sits beside the facts. */
        <>
          {sections}
          {tree ? (
            // items-start: the fact cards keep their own height instead of stretching into empty cards beside the taller path.
            <div className="grid items-start gap-4 md:grid-cols-2">
              <TriageTree tree={decision.tree} />
              {factsBlock}
            </div>
          ) : (
            factsBlock
          )}
        </>
      ) : (
        /* One section and its key on the left; the triage path beside it, or in the kata (no tree) the facts, so no well stands alone in an empty row. */
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {sections}
            {tree ? <TriageTree tree={decision.tree} /> : factsBlock}
          </div>
          {tree ? factsBlock : null}
        </>
      )}
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
      <p id={hintId} className="text-xs text-muted-foreground">
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
    <div role="group" aria-label="Facts of your bug" className="space-y-3 rounded-xl border border-border bg-card p-3">
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
        <p className="rounded-xl border border-border bg-card p-3 text-sm text-foreground">{scenario.prompt}</p>
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
    <section aria-label={title} className="space-y-2 rounded-xl border border-border bg-card p-3">
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
            <p className="rounded-xl border border-border bg-card p-3 text-sm text-foreground">
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
      className={cn("fig-panel", className)}
    >
      {kata ? <KataMode /> : <DecideMode preset={preset} />}
    </VisualFrame>
  );
}
