/**
 * Which production fix a late bug gets: a pre-tape-out ECO, a metal-only
 * respin, a full (base-layer) respin, or a firmware/defeature workaround now
 * with the real fix later. Used by FixPathDecisionLab in F1A.
 *
 * FIDELITY: a conceptual illustration of industry practice. No standard in
 * the project's primary sources (IEEE 1800-2023, IEEE 1800.2-2020, the Arm
 * AMBA specifications) covers ECO or respin practice, so this model encodes
 * only what the F1A lesson itself states. Each rule names the lesson section
 * it comes from ("F1A > <section>") instead of a clause number:
 * - "Fixing silicon: ECO, metal-only respin or full respin" (the respin
 *   figure, the fix table and the FIB / firmware / defeature table);
 * - "Worked example: four late bugs, four decisions";
 * - "How to triage a late bug" (steps 1 to 5 and the decision tree);
 * - "Expert: Designing for fixability" (spare cells and timing);
 * - "Estimation kata: four bugs, one ranking".
 *
 * There are no dollar figures, mask counts or node-specific claims. Cost
 * multipliers come only from COST_STAGES and costRatio in bug-cost-model.ts,
 * and delay classes use only the lesson's own wording.
 */

import { COST_STAGES, costRatio, formatMultiplier, stageIndex, type CostStage } from "@/lib/bug-cost-model";

export type StageId = CostStage["id"];

/** The fixes the lesson names. `depends` is the kata-3 answer: metal-only if timing closes, else full. */
export type FixKind = "spec" | "eco" | "metal" | "full" | "depends" | "workaround";

/** Prediction options: every fix plus the FIB distractor ("a FIB edit fixes the product"). */
export type PredictionId = FixKind | "fib";

export type Timing = "closes" | "fails" | "unknown";

/** F1A > Fixing silicon, FIB / firmware / defeature table: the two workaround paths that can cover production parts. */
export type WorkaroundPath = "none" | "firmware" | "defeature";

/** What the RTL fix needs. Null when the lesson leaves the size of the fix open (worked-example bug 4, kata 4). */
export interface SpareCount {
  gatesNeeded: number;
  spareCellsNearby: number;
}

export interface FixShape {
  /** A new structure, such as a pipeline stage of flip-flops, that only the base layers can provide. */
  needsNewTransistors: boolean;
  /**
   * Gates needed against spare cells within reach. Counts are whole numbers, 0
   * or more (0 gates means pure rewiring). "fits-nearby" is the lesson's
   * qualitative statement ("a few gates ... spare cells sit nearby");
   * "not-stated" when the lesson gives no count and the fix needs new
   * transistors or is made before tape-out, where the count does not matter.
   */
  spare: SpareCount | "fits-nearby" | "not-stated";
  /** Enough more spare cells sit elsewhere on the die (kata 3: "more sit on the far side of the die"). */
  spareCellsElsewhere: boolean;
  /** Whether physical design can close timing on the metal-only fix. */
  timing: Timing;
}

export interface BugFacts {
  /** Where the bug was found: a COST_STAGES id. */
  stage: StageId;
  workaround: WorkaroundPath;
  fix: FixShape | null;
}

/* ------------------------------------------------------------------ */
/* Stages                                                              */
/* ------------------------------------------------------------------ */

/**
 * F1A > Words you will meet ("Tape-out: sending the finished layout to the
 * fab") and the cost table: post-silicon and field bugs are found on chips that
 * exist, so their masks exist. Spec review, RTL simulation and full-chip
 * simulation or emulation all happen before tape-out.
 */
export function isTapedOut(stage: StageId): boolean {
  return stageIndex(stage) >= stageIndex("post-silicon");
}

export function stageOf(id: StageId): CostStage {
  const stage = COST_STAGES[stageIndex(id)];
  if (!stage) throw new RangeError(`Unknown stage: ${String(id)}`);
  return stage;
}

/** Stages the decide mode offers: the late ones. Spec review appears only in the kata. */
export const DECIDE_STAGES: readonly StageId[] = ["system", "post-silicon", "field"];

/* ------------------------------------------------------------------ */
/* Wording pinned to the lesson                                        */
/* ------------------------------------------------------------------ */

export const FIX_LABELS: Record<PredictionId, string> = {
  spec: "Clarify the spec",
  eco: "Pre-tape-out ECO",
  metal: "Metal-only respin",
  full: "Full (base-layer) respin",
  depends: "It depends: metal-only if timing closes, otherwise a full respin",
  workaround: "Firmware or defeature workaround now; the real fix later",
  fib: "FIB-edit the production parts",
};

/** F1A > Fixing silicon, fix table ("What changes"), and the kata's spec-review row. */
export const WHAT_CHANGES: Record<FixKind, string> = {
  spec: "The spec and the plan. Nothing has been built yet.",
  eco: "The design database only. No masks exist yet.",
  metal: "New masks for some metal and via layers. Spare cells already placed in the design supply the extra gates; held wafers are finished.",
  full: "New masks for the transistor layers too, usually most of the mask set. New wafers start from the beginning.",
  depends: "Some metal and via masks if a timing-clean metal-only fix exists; otherwise the base masks too, on new wafers.",
  workaround: "Firmware now, masks later. The shipped silicon does not change.",
};

/**
 * The lesson's held-wafer wording ("the fab can hold partly processed wafers
 * below the metal layers", the fix table; worked-example bug 2) comes from the
 * first-silicon context. It does not say whether wafers are still held months
 * after launch, so a metal-only fix for a field bug does not assume them.
 */
export const FIELD_METAL_WHAT_CHANGES =
  "New masks for some metal and via layers. Spare cells already placed in the design supply the extra gates; the base layers do not change. The lesson does not say whether partly processed wafers are still held after launch.";
export const FIELD_METAL_DELAY = "Weeks if partly processed wafers are still held; the lesson does not say whether they are after launch";

/** What changes for this fix, found at this stage. */
export function whatChangesFor(stage: StageId, kind: FixKind): string {
  return kind === "metal" && stage === "field" ? FIELD_METAL_WHAT_CHANGES : WHAT_CHANGES[kind];
}

/** The delay class for this fix, found at this stage. */
export function delayFor(stage: StageId, kind: FixKind): string {
  return kind === "metal" && stage === "field" ? FIELD_METAL_DELAY : DELAY_CLASSES[kind];
}

/**
 * Delay classes, in the lesson's words only: F1A > Worked example (bugs 1-4,
 * "Typical delay (project-dependent)") and Estimation kata (worked solution).
 */
export const DELAY_CLASSES: Record<FixKind, string> = {
  spec: "Hours",
  eco: "Days to weeks; no masks yet",
  metal: "Weeks",
  full: "Months",
  depends: "Weeks if metal-only closes; months if not",
  workaround: "Workaround as fast as a firmware release; the real fix waits for new silicon",
};

/**
 * Delay of the real fix by discovery stage, in the lesson's words: the kata's
 * worked solution (spec review: hours; full-chip: days to weeks; field) and the
 * cost table (RTL simulation: minutes to days; post-silicon: weeks to months).
 */
export const STAGE_DELAYS: Record<StageId, string> = {
  spec: "Hours",
  rtl: "Minutes to days",
  system: "Days to weeks",
  "post-silicon": "Weeks to months",
  field: "Workaround as fast as a firmware release; the real fix waits for new silicon",
};

/** F1A > Fixing silicon, pitfalls, and Interview angle "ECO or respin?": the three misconceptions the feedback diagnoses. */
export const MISCONCEPTIONS = {
  linesOfRtl:
    "Lines of RTL do not map to layers: one added line can create a register that needs new transistors, and only the base layers can provide transistors.",
  anyBugInMetal:
    "Not every bug can be fixed in metal. Metal and via masks only rewire existing transistors; a fix that needs more logic than the spare cells within reach provide needs a full respin.",
  fibFixesProduction:
    "A FIB edit cuts and adds wires on a handful of sample chips in the lab. It confirms that a fix works before the masks are paid for, but it is not a way to build production parts: production still needs new masks or a workaround.",
  everyFixIsFull:
    "Not every silicon fix needs a full respin: metal-only respins exist because many fixes are small rewiring jobs. That is why designs carry spare cells.",
} as const;

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function checkCount(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a whole number, 0 or more (got ${String(value)})`);
  }
}

/**
 * Rejects facts the model does not cover:
 * - a bug found in RTL simulation is not a late bug: the lesson's fix there is an
 *   RTL edit and a block rerun (cost table), not a production fix;
 * - a workaround before tape-out: the lesson uses one only for parts that exist;
 * - a fix that needs new transistors before tape-out: the lesson's pre-tape-out
 *   ECO is "a small fix found late before tape-out", and "larger changes go back
 *   through synthesis and place-and-route" (F1A > Fixing silicon, fix table),
 *   which the lesson does not size or name as an ECO;
 * - negative or fractional gate and spare-cell counts.
 */
export function validateFacts(facts: BugFacts): void {
  stageOf(facts.stage);
  if (facts.stage === "rtl") {
    throw new RangeError("Bugs found in RTL simulation are not modelled: the lesson's fix there is an RTL edit and a block rerun.");
  }
  if (!isTapedOut(facts.stage) && facts.workaround !== "none") {
    throw new RangeError("A workaround is modelled only after tape-out, for parts that exist.");
  }
  if (!isTapedOut(facts.stage) && facts.fix?.needsNewTransistors) {
    throw new RangeError(
      "Before tape-out only a small fix (a pre-tape-out ECO) is modelled: a larger change goes back through synthesis and place-and-route.",
    );
  }
  if (facts.fix && typeof facts.fix.spare === "object") {
    checkCount("gatesNeeded", facts.fix.spare.gatesNeeded);
    checkCount("spareCellsNearby", facts.fix.spare.spareCellsNearby);
  }
  if (isTapedOut(facts.stage) && facts.fix && !facts.fix.needsNewTransistors && facts.fix.spare === "not-stated") {
    throw new RangeError("After tape-out, a fix without new transistors needs its spare-cell fit stated.");
  }
  if (isTapedOut(facts.stage) && facts.workaround === "none" && !facts.fix) {
    throw new RangeError("After tape-out without a workaround, the fix's shape decides between metal-only and full respin.");
  }
}

/* ------------------------------------------------------------------ */
/* The decision                                                        */
/* ------------------------------------------------------------------ */

export type RespinPath = "metal" | "full" | "depends";

/** The spare-cell question of triage step 4. */
export type SpareFit = "nearby" | "elsewhere" | "none";

/** F1A > Expert: Designing for fixability: the fix fits in the cells within reach, needs distant ones, or cannot fit. */
export function spareFit(fix: FixShape): SpareFit {
  if (fix.spare === "fits-nearby") return "nearby";
  if (fix.spare === "not-stated") throw new RangeError("The spare-cell fit is not stated for this fix.");
  checkCount("gatesNeeded", fix.spare.gatesNeeded);
  checkCount("spareCellsNearby", fix.spare.spareCellsNearby);
  if (fix.spare.gatesNeeded <= fix.spare.spareCellsNearby) return "nearby";
  return fix.spareCellsElsewhere ? "elsewhere" : "none";
}

/**
 * Triage step 4 (F1A > How to triage a late bug): "if the fix fits in rewiring
 * plus spare cells, plan a metal-only respin ...; otherwise plan a full
 * respin". New transistors force a full respin (F1A > Fixing silicon: "The fix
 * needs new transistors or a larger logic change"). Too few spare cells within
 * reach, or long routes to distant cells that fail timing, make it a full
 * respin after all (F1A > Expert: Designing for fixability). With timing
 * unknown the answer is the kata-3 one: it depends on physical design.
 */
export function respinPath(fix: FixShape): RespinPath {
  if (fix.needsNewTransistors) return "full";
  if (spareFit(fix) === "none") return "full";
  if (fix.timing === "closes") return "metal";
  if (fix.timing === "fails") return "full";
  return "depends";
}

export type TreeAnswer = "yes" | "no" | "depends" | "open";

export interface TreeStep {
  /** Step number in F1A > How to triage a late bug. */
  step: 2 | 3 | 4;
  /** Node label in the lesson's decision tree. */
  node: string;
  question: string;
  answer: TreeAnswer;
  /** The fix this answer leads to, or null when the path goes on to the next question. */
  leadsTo: string | null;
  /** "production": the fix customers get now; "real-fix": the path the RTL fix takes after a workaround. */
  role: "production" | "real-fix";
}

export type LayerState = "new" | "reused" | "no-mask";

export interface LayerBand {
  id: "metal-upper" | "metal-middle" | "metal-lowest" | "base";
  label: string;
  state: LayerState;
}

/** A cross-section in the encoding of the lesson's respin figure. */
export interface CrossSection {
  caption: string;
  layers: LayerBand[];
}

export const LAYER_STATE_LABELS: Record<LayerState, string> = {
  new: "new mask",
  reused: "reused (held wafer or shipped silicon)",
  "no-mask": "no mask yet",
};

const LAYERS: { id: LayerBand["id"]; label: string }[] = [
  { id: "metal-upper", label: "upper metal + vias" },
  { id: "metal-middle", label: "metal + vias" },
  { id: "metal-lowest", label: "lowest metal" },
  { id: "base", label: "base (transistors)" },
];

/**
 * F1A > Fixing silicon, respin figure: (a) pre-tape-out ECO: every layer dashed
 * (no mask yet); (b) metal-only: the upper metal and via layers hatched (new),
 * the lowest metal and the base solid (reused, held wafers); (c) full respin:
 * every layer hatched. The worked-example figure adds bug 4: every layer solid,
 * because the shipped silicon is unchanged. Spec review: nothing is built yet.
 */
export function layersFor(kind: Exclude<FixKind, "depends">): LayerBand[] {
  const state = (id: LayerBand["id"]): LayerState => {
    switch (kind) {
      case "spec":
      case "eco":
        return "no-mask";
      case "metal":
        return id === "metal-upper" || id === "metal-middle" ? "new" : "reused";
      case "full":
        return "new";
      case "workaround":
        return "reused";
    }
  };
  return LAYERS.map((l) => ({ ...l, state: state(l.id) }));
}

export interface FixDecision {
  kind: FixKind;
  /** After a workaround: the path the RTL fix takes, or "next-revision" when the lesson leaves its size open. */
  realFix: RespinPath | "next-revision" | null;
  stage: CostStage;
  tapedOut: boolean;
  /** Rule-of-thumb cost, from COST_STAGES (with "or more" for a full or possible full respin at post-silicon). */
  multiplierText: string;
  delay: string;
  whatChanges: string;
  /** One sentence: why this fix, generated from the facts. */
  why: string;
  tree: TreeStep[];
  sections: CrossSection[];
  /** A one-line text alternative for the whole result. */
  summary: string;
}

/** Node labels of the lesson's triage tree (F1A > How to triage a late bug). */
export const TREE_NODES = {
  2: { node: "2 Avoidable?", question: "Can firmware, a defeature bit or a software rule avoid the bug safely?" },
  3: { node: "3 Taped out?", question: "Do masks exist?" },
  4: { node: "4 Metal fix?", question: "Does the fix fit in rewiring plus spare cells?" },
} as const;

/** Where each answer leads in the lesson's tree: a fix, or the next question. */
export const TREE_BRANCHES: Record<2 | 3 | 4, { yes: string; no: string }> = {
  2: { yes: "Workaround: now; the RTL fix, if needed, takes the path below", no: "Go to step 3" },
  3: { yes: "Go to step 4", no: FIX_LABELS.eco },
  4: { yes: `${FIX_LABELS.metal} (FIB-confirm first)`, no: FIX_LABELS.full },
};

/** Step 5 follows whatever the fix (the lesson's tree: every fix leads to "5 Escape"). */
export const TREE_STEP5 = { node: "5 Escape", question: "Name the earlier activity that should have caught the bug; add the missing scenario, check and coverage item to the plan." };

function respinTreeStep(path: RespinPath | "next-revision", role: TreeStep["role"]): TreeStep {
  const base = { step: 4 as const, ...TREE_NODES[4], role };
  switch (path) {
    case "metal":
      return { ...base, answer: "yes", leadsTo: FIX_LABELS.metal };
    case "full":
      return { ...base, answer: "no", leadsTo: FIX_LABELS.full };
    case "depends":
      return { ...base, answer: "depends", leadsTo: "Metal-only if physical design finds a timing-clean fix; otherwise a full respin" };
    case "next-revision":
      return { ...base, answer: "open", leadsTo: "The lesson leaves the size of this fix open: it goes into the next silicon revision" };
  }
}

/** Triage steps 2-4 (F1A > How to triage a late bug), with the path this bug takes. */
export function treePath(facts: BugFacts): TreeStep[] {
  validateFacts(facts);
  if (facts.stage === "spec") return [];
  const tapedOut = isTapedOut(facts.stage);
  const steps: TreeStep[] = [];
  const hasWorkaround = facts.workaround !== "none";
  steps.push({
    step: 2,
    ...TREE_NODES[2],
    answer: hasWorkaround ? "yes" : "no",
    leadsTo: hasWorkaround ? FIX_LABELS.workaround : null,
    role: "production",
  });
  const role: TreeStep["role"] = hasWorkaround ? "real-fix" : "production";
  steps.push({ step: 3, ...TREE_NODES[3], answer: tapedOut ? "yes" : "no", leadsTo: tapedOut ? null : FIX_LABELS.eco, role });
  if (tapedOut) steps.push(respinTreeStep(facts.fix ? respinPath(facts.fix) : "next-revision", role));
  return steps;
}

/**
 * The production fix (F1A > How to triage a late bug, steps 2-4):
 * spec review: clarify the spec (kata 1); step 2: a workaround protects
 * customers now and the RTL fix takes the path below; step 3: before tape-out,
 * an ECO in the design database; step 4: after tape-out, metal-only or full.
 */
export function decideKind(facts: BugFacts): { kind: FixKind; realFix: FixDecision["realFix"] } {
  validateFacts(facts);
  if (facts.stage === "spec") return { kind: "spec", realFix: null };
  if (!isTapedOut(facts.stage)) return { kind: "eco", realFix: null };
  if (facts.workaround !== "none") return { kind: "workaround", realFix: facts.fix ? respinPath(facts.fix) : "next-revision" };
  // validateFacts guarantees a fix shape here.
  return { kind: respinPath(facts.fix as FixShape), realFix: null };
}

/**
 * Rule-of-thumb cost from COST_STAGES. The worked example (bug 3) and the kata
 * (scenario 3) write "×1,000 or more" for a full or possible full respin found
 * post-silicon; every other row is the stage multiplier alone.
 */
export function multiplierText(stage: StageId, kind: FixKind): string {
  const base = formatMultiplier(stageOf(stage).multiplier);
  return stage === "post-silicon" && (kind === "full" || kind === "depends") ? `${base} or more` : base;
}

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

function respinWhy(fix: FixShape, path: RespinPath): string {
  if (fix.needsNewTransistors) return "The fix needs new transistors, which only the base layers can provide, so every mask changes and new wafers start from the beginning.";
  const fit = spareFit(fix);
  const counts =
    typeof fix.spare === "object"
      ? ` (${plural(fix.spare.gatesNeeded, "gate", "gates")} needed, ${plural(fix.spare.spareCellsNearby, "spare cell", "spare cells")} nearby)`
      : "";
  if (fit === "none") return `The spare cells within reach cannot build the fix${counts} and no others are available, so it needs new transistors: a full respin.`;
  const where =
    fit === "nearby"
      ? typeof fix.spare === "object" && fix.spare.gatesNeeded === 0
        ? "The fix is pure rewiring"
        : `The fix fits in the spare cells nearby${counts}`
      : `The spare cells nearby cannot build the fix${counts}, and wiring to distant spare cells adds long routes`;
  if (path === "metal") return `${where}, and timing closes, so only metal and via masks change. A FIB edit on a few samples proves the fix before the masks are bought.`;
  if (path === "full") return `${where}, but timing fails, so it is a full respin after all.`;
  return `${where}, and timing is not known yet. If physical design finds a timing-clean metal-only fix, it is a metal-only respin (confirm it first with a FIB edit); if not, a full respin.`;
}

function workaroundWhy(path: WorkaroundPath, realFix: FixDecision["realFix"], fix: FixShape | null): string {
  const now =
    path === "defeature"
      ? "The defeature bit protects customers now: set it through a firmware update."
      : "A firmware update avoids the bug now, because the hardware gives software a way in.";
  const later =
    realFix === "next-revision" || realFix === null || !fix
      ? " The RTL is still fixed, in the next silicon revision."
      : ` The RTL is still fixed in new silicon: ${FIX_LABELS[realFix].toLowerCase()}. ${respinWhy(fix, realFix)}`;
  return now + later;
}

function whyText(facts: BugFacts, kind: FixKind, realFix: FixDecision["realFix"]): string {
  switch (kind) {
    case "spec":
      return "Nothing is built yet: reword the requirement, tell the team, and add the missing row to the plan.";
    case "eco":
      return "Before tape-out no masks exist, so a small late fix is only a database edit. The cost is the debug and re-verification at full-chip level.";
    case "workaround":
      return workaroundWhy(facts.workaround, realFix, facts.fix);
    default:
      return respinWhy(facts.fix as FixShape, kind);
  }
}

function sectionsFor(kind: FixKind, realFix: FixDecision["realFix"]): CrossSection[] {
  if (kind === "depends") {
    return [
      { caption: "If timing closes: metal-only respin", layers: layersFor("metal") },
      { caption: "If not: full respin", layers: layersFor("full") },
    ];
  }
  if (kind === "workaround") {
    const now: CrossSection = { caption: "Now: the shipped silicon is unchanged", layers: layersFor("workaround") };
    if (realFix === "metal" || realFix === "full") return [now, { caption: `Later: ${FIX_LABELS[realFix].toLowerCase()}`, layers: layersFor(realFix) }];
    if (realFix === "depends") {
      return [
        now,
        { caption: "Later, if timing closes: metal-only respin", layers: layersFor("metal") },
        { caption: "Later, if not: full respin", layers: layersFor("full") },
      ];
    }
    return [now];
  }
  const captions: Record<Exclude<FixKind, "depends" | "workaround">, string> = {
    spec: "Nothing is built yet",
    eco: "Pre-tape-out ECO: no mask exists yet",
    metal: "Metal-only respin",
    full: "Full respin",
  };
  return [{ caption: captions[kind], layers: layersFor(kind) }];
}

export function decide(facts: BugFacts): FixDecision {
  const { kind, realFix } = decideKind(facts);
  const stage = stageOf(facts.stage);
  const label = kind === "workaround" && facts.workaround === "defeature" ? "Defeature bit through a firmware update now; the real fix later" : FIX_LABELS[kind];
  const decision: FixDecision = {
    kind,
    realFix,
    stage,
    tapedOut: isTapedOut(facts.stage),
    multiplierText: multiplierText(facts.stage, kind),
    delay: delayFor(facts.stage, kind),
    whatChanges: whatChangesFor(facts.stage, kind),
    why: whyText(facts, kind, realFix),
    tree: treePath(facts),
    sections: sectionsFor(kind, realFix),
    summary: "",
  };
  decision.summary = `Fix: ${label}. Found at ${stage.label}, rule-of-thumb cost ${decision.multiplierText}. Delay: ${decision.delay}.`;
  return decision;
}

/* ------------------------------------------------------------------ */
/* Prediction feedback                                                 */
/* ------------------------------------------------------------------ */

const STEP2_FIRST =
  "Step 2 comes first: a workaround is available, so it protects customers now. A respin is still how the RTL gets fixed, but later, in new silicon.";
const NO_MASKS_YET = "Before tape-out no masks exist, so there is nothing to respin: the fix is an edit to the design database (a pre-tape-out ECO).";
const MASKS_EXIST = "Once the chip is taped out the masks exist: a change now means new masks (a respin) or a workaround. A pre-tape-out ECO edits only the design database.";
/** FIB feedback at spec review, where no chip exists to edit. */
export const FIB_AT_SPEC =
  "Nothing has been built at spec review: there is no chip, so there is nothing for a FIB edit to cut or wire. A FIB edit works only on sample chips in the lab.";
const NO_WORKAROUND = "This chip offers no firmware or defeature path for this bug, and a workaround needs that path built into the hardware before tape-out.";

export interface PredictionFeedback {
  correct: boolean;
  feedback: string;
}

/** Feedback for one prediction option, generated from the facts so that it cannot disagree with decide(). */
export function predictionFeedback(facts: BugFacts, option: PredictionId): PredictionFeedback {
  const d = decide(facts);
  if (option === d.kind) return { correct: true, feedback: d.why };
  if (option === "fib" && d.kind === "spec") return { correct: false, feedback: FIB_AT_SPEC };
  if (option === "fib") return { correct: false, feedback: MISCONCEPTIONS.fibFixesProduction };
  const wrong = (feedback: string): PredictionFeedback => ({ correct: false, feedback });
  if (d.kind === "spec") return wrong("Nothing has been built at spec review: no RTL to edit and no masks. Reword the requirement and add the missing row to the plan.");
  if (option === "spec") return wrong("A spec clarification fixes a bug only while nothing is built. This bug is already in the design.");
  if (option === "eco" && d.tapedOut) return wrong(MASKS_EXIST);
  if (option === "workaround") return wrong(NO_WORKAROUND);
  if (d.kind === "workaround") return wrong(STEP2_FIRST);
  if (d.kind === "eco") return wrong(NO_MASKS_YET);
  const fix = facts.fix as FixShape;
  if (option === "metal") {
    if (fix.needsNewTransistors) return wrong(MISCONCEPTIONS.linesOfRtl);
    if (spareFit(fix) === "none") return wrong(MISCONCEPTIONS.anyBugInMetal);
    if (fix.timing === "fails") return wrong("The spare cells could supply the gates, but the routes fail timing, so the metal-only fix does not close: a full respin after all.");
    return wrong("Timing is not known yet, so metal-only is only one possible outcome: physical design decides whether a timing-clean metal-only fix exists.");
  }
  if (option === "full") {
    if (d.kind === "metal") return wrong(MISCONCEPTIONS.everyFixIsFull);
    return wrong("Timing is not known yet, so a full respin is only one possible outcome: if physical design finds a timing-clean metal-only fix, the base masks are reused.");
  }
  // option === "depends", but the facts settle it.
  return wrong(`Nothing here is left open. ${d.why}`);
}

/* ------------------------------------------------------------------ */
/* Escape analysis                                                     */
/* ------------------------------------------------------------------ */

export interface EscapeNote {
  /** The earlier activity that should have caught the bug, in the lesson's terms. */
  activity: string;
  /** Its stage, when the lesson's reasoning names one. */
  stage: StageId | null;
  /**
   * True when the lesson does not state this escape analysis and the activity is
   * an example drawn from the lesson's other sections; the line then says "for example".
   */
  example?: boolean;
}

/**
 * Triage step 5 (F1A > How to triage a late bug): name the earlier activity
 * that should have caught the bug and add the missing scenario, check and
 * coverage item to the plan. The ratio is costRatio from bug-cost-model.
 */
export function escapeLine(found: StageId, escape: EscapeNote | null): string {
  if (found === "spec") return "Escape analysis: none needed. Spec review is the earliest stage; the fix is the missing row in the plan.";
  if (!escape) {
    return "Escape analysis (step 5): name the earlier activity that should have caught the bug, then add the missing scenario, check and coverage item to the plan.";
  }
  const head = `Escape analysis (step 5)${escape.example ? ", for example" : ""}: ${escape.activity}.`;
  if (!escape.stage || stageIndex(escape.stage) >= stageIndex(found)) return head;
  const earlier = stageOf(escape.stage);
  const later = stageOf(found);
  const ratio = costRatio(escape.stage, found).toLocaleString("en-US");
  return `${head} Caught at ${earlier.label} (${formatMultiplier(earlier.multiplier)}) instead of ${later.label} (${formatMultiplier(later.multiplier)}), the rule of thumb says it costs ${ratio} times less.`;
}

/* ------------------------------------------------------------------ */
/* Scenarios                                                           */
/* ------------------------------------------------------------------ */

export interface FixScenario {
  id: string;
  /** Short name for the scenario switcher. */
  short: string;
  /** The scenario as the lesson states it. */
  prompt: string;
  facts: BugFacts;
  escape: EscapeNote | null;
  /** A lesson-specific detail of the fix (kata solution), shown after the reveal. */
  detail?: string;
  /** The decision the lesson states; tests pin decide() to it. */
  lessonKind: FixKind;
}

/** F1A > Worked example: four late bugs, four decisions. */
export const DECIDE_SCENARIOS: readonly FixScenario[] = [
  {
    id: "reset-value",
    short: "1 · Wrong reset value",
    prompt: "A control register resets to the wrong value. Full-chip simulation finds it three weeks before tape-out.",
    facts: {
      stage: "system",
      workaround: "none",
      fix: { needsNewTransistors: false, spare: "not-stated", spareCellsElsewhere: false, timing: "unknown" },
    },
    escape: { activity: "block-level simulation of the register, with full visibility, should have checked its reset value", stage: "rtl", example: true },
    lessonKind: "eco",
  },
  {
    id: "comparator",
    short: "2 · > vs >=",
    prompt: "On first silicon, a comparator uses \"greater than\" where the spec says \"greater than or equal\". The fix is a few gates, and spare cells sit nearby.",
    facts: {
      stage: "post-silicon",
      workaround: "none",
      fix: { needsNewTransistors: false, spare: "fits-nearby", spareCellsElsewhere: false, timing: "closes" },
    },
    escape: { activity: "a block-level test that tried the exact boundary value, as in the lesson's comparator example", stage: "rtl", example: true },
    lessonKind: "metal",
  },
  {
    id: "pipeline-stage",
    short: "3 · New pipeline stage",
    prompt: "On first silicon, the fix turns out to need a new pipeline stage of several hundred flip-flops.",
    facts: {
      stage: "post-silicon",
      workaround: "none",
      fix: { needsNewTransistors: true, spare: "not-stated", spareCellsElsewhere: false, timing: "unknown" },
    },
    escape: null,
    lessonKind: "full",
  },
  {
    id: "field-corruption",
    short: "4 · Field corruption",
    prompt: "A customer sees data corruption under a rare traffic mix. A defeature bit can switch the feature off.",
    facts: { stage: "field", workaround: "defeature", fix: null },
    escape: { activity: "ask why no test combined that traffic mix, and add it to the plan", stage: null },
    lessonKind: "workaround",
  },
];

/** F1A > Estimation kata: four bugs, one ranking. */
export const KATA_SCENARIOS: readonly FixScenario[] = [
  {
    id: "kata-fifo-spec",
    short: "Kata 1",
    prompt: "During spec review, the DV lead notices that the spec never says what a FIFO does when written while full.",
    facts: { stage: "spec", workaround: "none", fix: null },
    escape: null,
    detail: "Clarify the spec (drop the write, or flag an error) and add a \"write when full\" row to the plan.",
    lessonKind: "spec",
  },
  {
    id: "kata-interrupt",
    short: "Kata 2",
    prompt: "Three weeks before tape-out, full-chip simulation finds that an interrupt is cleared one cycle too early. The RTL fix is two lines.",
    facts: {
      stage: "system",
      workaround: "none",
      fix: { needsNewTransistors: false, spare: "not-stated", spareCellsElsewhere: false, timing: "unknown" },
    },
    escape: { activity: "the plan had no check on when the interrupt clears: add a scenario and an assertion for it at block level", stage: "rtl" },
    detail: "Edit the RTL, then rerun the regression and the physical checks. A larger change would go back through synthesis and place-and-route.",
    lessonKind: "eco",
  },
  {
    id: "kata-spare-cells",
    short: "Kata 3",
    prompt: "On first silicon, a 4-bit compare must become a 5-bit compare. The fix needs about 40 gates, but only 12 spare cells sit near that logic; more sit on the far side of the die.",
    facts: {
      stage: "post-silicon",
      workaround: "none",
      fix: { needsNewTransistors: false, spare: { gatesNeeded: 40, spareCellsNearby: 12 }, spareCellsElsewhere: true, timing: "unknown" },
    },
    escape: null,
    lessonKind: "depends",
  },
  {
    id: "kata-dma-wake",
    short: "Kata 4",
    prompt: "Six months after launch, a customer sees rare corruption when the DMA engine starts a transfer within two cycles of waking from clock gating. The boot firmware starts the DMA engine and can wait before doing so; the chip has no defeature bit for this path.",
    facts: { stage: "field", workaround: "firmware", fix: null },
    escape: { activity: "add the wake-then-DMA scenario to the plan", stage: null },
    detail: "Firmware waits a few cycles after wake-up before starting the DMA engine. The RTL is fixed in the next silicon revision.",
    lessonKind: "workaround",
  },
];

export const DECIDE_PRESET_IDS = [...DECIDE_SCENARIOS.map((s) => s.id), "custom"] as const;

export function findScenario(id: string | undefined): FixScenario | undefined {
  return [...DECIDE_SCENARIOS, ...KATA_SCENARIOS].find((s) => s.id === id);
}

/** Starting facts for the custom mode: a post-silicon bug whose fix fits in nearby spare cells. */
export const CUSTOM_DEFAULT: BugFacts = {
  stage: "post-silicon",
  workaround: "none",
  fix: { needsNewTransistors: false, spare: { gatesNeeded: 4, spareCellsNearby: 12 }, spareCellsElsewhere: false, timing: "closes" },
};

/** Prediction options, in a fixed order that does not depend on the answer. */
export function predictionOptions(mode: "decide" | "kata"): PredictionId[] {
  const fixes: PredictionId[] = ["eco", "metal", "full", "depends", "workaround", "fib"];
  return mode === "kata" ? ["spec", ...fixes] : fixes;
}

/** Plain-text facts the learner sees before predicting. They state inputs only, never the fix. */
export function factLines(facts: BugFacts): string[] {
  const lines = [`Found at: ${stageOf(facts.stage).label}`, `Taped out: ${isTapedOut(facts.stage) ? "yes, masks exist" : "no, no masks yet"}`];
  if (facts.stage === "spec") return lines;
  lines.push(
    `Workaround path: ${facts.workaround === "none" ? "none" : facts.workaround === "defeature" ? "a defeature bit, set by firmware" : "firmware can avoid the bug"}`,
  );
  if (!facts.fix) {
    lines.push("Size of the RTL fix: not stated");
    return lines;
  }
  const f = facts.fix;
  lines.push(`Needs new transistors (a new structure): ${f.needsNewTransistors ? "yes" : "no"}`);
  if (isTapedOut(facts.stage)) {
    lines.push(
      typeof f.spare === "object"
        ? `Gates needed: ${f.spare.gatesNeeded.toLocaleString("en-US")}; spare cells nearby: ${f.spare.spareCellsNearby.toLocaleString("en-US")}`
        : f.spare === "fits-nearby"
          ? "Spare cells: enough sit nearby"
          : "Spare cells: not stated",
    );
    lines.push(`More spare cells elsewhere on the die: ${f.spareCellsElsewhere ? "yes" : "no"}`);
    lines.push(`Timing of a metal-only fix: ${f.timing === "closes" ? "closes" : f.timing === "fails" ? "fails" : "unknown"}`);
  }
  return lines;
}

/* ------------------------------------------------------------------ */
/* Kata ranking                                                        */
/* ------------------------------------------------------------------ */

/** The five discovery stages, cheapest first, read from COST_STAGES. */
export function costOrder(): StageId[] {
  return [...COST_STAGES].sort((a, b) => a.multiplier - b.multiplier).map((s) => s.id);
}

/** A starting order for the ranking tasks that is not the answer. */
export const RANKING_START: readonly StageId[] = ["field", "rtl", "post-silicon", "spec", "system"];

export type RankMark = "correct" | "wrong";

/** Marks every stage by its position against the cost order (cheapest first). */
export function gradeCostOrder(order: readonly StageId[]): Partial<Record<StageId, RankMark>> {
  const answer = costOrder();
  const marks: Partial<Record<StageId, RankMark>> = {};
  order.forEach((id, i) => {
    marks[id] = answer[i] === id ? "correct" : "wrong";
  });
  return marks;
}

/**
 * F1A > Estimation kata, worked solution: "By delay the order is the same,
 * except that a field bug with a workaround can be contained quickly while its
 * real fix waits for new silicon." So the four other stages are graded by
 * their order relative to each other (shortest first), and the field stage is
 * left ungraded wherever it sits.
 */
export function gradeDelayOrder(order: readonly StageId[]): Partial<Record<StageId, RankMark>> {
  const answer = costOrder().filter((id) => id !== "field");
  const rest = order.filter((id) => id !== "field");
  const marks: Partial<Record<StageId, RankMark>> = {};
  rest.forEach((id, i) => {
    marks[id] = answer[i] === id ? "correct" : "wrong";
  });
  return marks;
}

export function allCorrect(marks: Partial<Record<StageId, RankMark>>): boolean {
  return Object.values(marks).every((m) => m === "correct");
}

export const DELAY_EXCEPTION =
  "By delay the order is the same, except that a field bug with a workaround can be contained quickly while its real fix waits for new silicon. The field stage is not graded: ranked by containment it moves up, ranked by the real fix it stays last.";

/** The cost explanation, generated from COST_STAGES. */
export function costExplanation(): string {
  const ordered = costOrder().map((id) => `${stageOf(id).label} ${formatMultiplier(stageOf(id).multiplier)}`);
  return `Cheapest first: ${ordered.join(", ")}. Each later stage is about ten times the one before: a rule of thumb, not data.`;
}
