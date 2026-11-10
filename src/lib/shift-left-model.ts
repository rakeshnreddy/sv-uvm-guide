/**
 * Shift-left timeline for F1A ("Shift left and the verification lifecycle").
 *
 * Fidelity: conceptual illustration. No standard defines shift left, its
 * activities or what each one catches. Every rule here comes from the F1A
 * lesson itself, and each rule names the lesson passage it encodes:
 * - the shift-left table ("Activity | When it runs | What it catches early");
 * - quiz question 10 ("Which pairing of a bug kind with the earliest activity
 *   that reliably catches it is right?") and its feedback;
 * - the "schedule slips" predict-reveal under the shift-left figure (bugs move
 *   to full-chip simulation or emulation and, for the ones only the lab or a
 *   customer will hit, past the dashed tape-out line);
 * - the pitfall paragraph ("shifting left does not remove the late stages").
 *
 * Cost multipliers are never typed here: they are read from COST_STAGES and
 * costRatio in bug-cost-model.ts, the lesson's rule of thumb (×10 per stage).
 */

import { COST_STAGES, costRatio, formatMultiplier, stageIndex, type CostStage } from "@/lib/bug-cost-model";

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

/** Where a token can land. "after-tape-out" covers the silicon lab and the field. */
export type TimelineStageId = "spec" | "rtl" | "integration" | "after-tape-out";

export interface TimelineStage {
  id: TimelineStageId;
  label: string;
  /** How a sentence names the lane: "at spec review", "during RTL". */
  phrase: string;
  /** The cost-ladder stage(s) this lane stands for (bug-cost-model ids). */
  costStages: CostStage["id"][];
  /** True for the lane right of the dashed tape-out line. */
  afterTapeOut: boolean;
}

export const TIMELINE: TimelineStage[] = [
  { id: "spec", label: "Spec", phrase: "at spec review", costStages: ["spec"], afterTapeOut: false },
  { id: "rtl", label: "RTL", phrase: "while the RTL is written", costStages: ["rtl"], afterTapeOut: false },
  { id: "integration", label: "Integration", phrase: "at integration, before tape-out", costStages: ["system"], afterTapeOut: false },
  { id: "after-tape-out", label: "After tape-out: silicon lab or field", phrase: "after tape-out", costStages: ["post-silicon", "field"], afterTapeOut: true },
];

export function timelineStage(id: TimelineStageId): TimelineStage {
  const stage = TIMELINE.find((s) => s.id === id);
  if (!stage) throw new Error(`Unknown timeline stage ${id}`);
  return stage;
}

function costStage(id: CostStage["id"]): CostStage {
  return COST_STAGES[stageIndex(id)];
}

/** "×10", or "×1,000 to ×10,000" for the lane that spans the lab and the field. */
export function laneMultiplierText(id: TimelineStageId): string {
  const stages = timelineStage(id).costStages.map(costStage);
  if (stages.length === 1) return formatMultiplier(stages[0].multiplier);
  return `${formatMultiplier(stages[0].multiplier)} to ${formatMultiplier(stages[stages.length - 1].multiplier)}`;
}

/* ------------------------------------------------------------------ */
/* Activities (the lesson's shift-left table)                          */
/* ------------------------------------------------------------------ */

export type ActivityId = "planning" | "lint" | "block-sim" | "block-formal" | "emulation";

export interface Activity {
  id: ActivityId;
  label: string;
  /** The label as it reads mid-sentence ("lint", "formal on blocks"). */
  inSentence: string;
  short: string;
  /** The "When it runs" column of the lesson's shift-left table. */
  when: string;
  stage: TimelineStageId;
  /** Text of the lesson's table row this activity is pinned to (tested against the lesson). */
  lessonRow: string;
}

/**
 * Lesson shift-left table, one row per activity. The fifth toggle stands for
 * full-chip simulation and emulation together: the cost ladder gives them one
 * stage ("Full-chip / emulation", ×100), and the lesson sends bugs that lint and
 * block simulation miss "to full-chip simulation or emulation".
 */
export const ACTIVITIES: Activity[] = [
  { id: "planning", label: "Verification planning", inSentence: "verification planning", short: "Planning", when: "At spec review", stage: "spec", lessonRow: "| Verification planning | At spec review |" },
  { id: "lint", label: "Lint", inSentence: "lint", short: "Lint", when: "As RTL is written", stage: "rtl", lessonRow: "| Lint | As RTL is written |" },
  { id: "block-sim", label: "Block-level simulation", inSentence: "block-level simulation", short: "Block sim", when: "As each block works", stage: "rtl", lessonRow: "| Block-level simulation | As each block works |" },
  { id: "block-formal", label: "Formal on blocks", inSentence: "formal on blocks", short: "Block formal", when: "As each block works", stage: "rtl", lessonRow: "| Formal on blocks | As each block works |" },
  { id: "emulation", label: "Full-chip simulation or emulation", inSentence: "full-chip simulation or emulation", short: "Full-chip / emulation", when: "Before tape-out", stage: "integration", lessonRow: "| Emulation or FPGA prototyping | Before tape-out |" },
];

export const ALL_ACTIVITIES: ActivityId[] = ACTIVITIES.map((a) => a.id);

export function activity(id: ActivityId): Activity {
  const found = ACTIVITIES.find((a) => a.id === id);
  if (!found) throw new Error(`Unknown activity ${id}`);
  return found;
}

/* ------------------------------------------------------------------ */
/* Bug kinds and their reliable catchers                               */
/* ------------------------------------------------------------------ */

export type BugId = "spec-contradiction" | "latch-width" | "block-functional" | "arbiter-corner" | "boot-hang" | "block-interaction";

export interface BugKind {
  id: BugId;
  /** Token number shown on the timeline (1-6). */
  glyph: string;
  label: string;
  short: string;
  /**
   * Activities that catch this kind reliably, earliest first. The first entry
   * is its earliest catcher. A token lands at the first enabled entry; with
   * none enabled it passes the tape-out line.
   */
  catchers: ActivityId[];
  /** The lesson passage that gives the earliest catcher (tested against the lesson). */
  lessonEvidence: string;
  /** Why no later pre-tape-out activity catches it reliably, when catchers has one entry. */
  missedWhy?: string;
}

export const BUGS: BugKind[] = [
  {
    // Lesson table row "Verification planning"; quiz question 10, option 1 feedback.
    id: "spec-contradiction",
    glyph: "1",
    label: "A spec that contradicts itself",
    short: "Spec contradiction",
    catchers: ["planning"],
    lessonEvidence: "Missing, ambiguous or contradictory requirements, at ×1",
    missedWhy: "Simulation checks the RTL against the spec; it cannot settle which half of a contradictory spec is right.",
  },
  {
    // Lesson table row "Lint"; quiz question 10, correct option. Fallback: the
    // schedule-slip reveal ("move right along the timeline: to full-chip simulation or emulation").
    id: "latch-width",
    glyph: "2",
    label: "An unintended latch or a width mismatch",
    short: "Latch or width mismatch",
    catchers: ["lint", "emulation"],
    lessonEvidence: "unintended latches, width mismatches",
  },
  {
    // Lesson table row "Block-level simulation"; same fallback as lint.
    id: "block-functional",
    glyph: "3",
    label: "A functional bug inside one block",
    short: "Block functional bug",
    catchers: ["block-sim", "emulation"],
    lessonEvidence: "Functional bugs in one block",
  },
  {
    // Lesson table row "Formal on blocks"; quiz question 10, option 4 feedback.
    id: "arbiter-corner",
    glyph: "4",
    label: "An arbiter, FIFO or state-machine corner case",
    short: "Control corner case",
    catchers: ["block-formal"],
    lessonEvidence: "Corner cases in control logic (arbiters, FIFOs, state machines) that random stimulus rarely reaches",
    missedWhy: "Random stimulus rarely reaches it, so simulation, whenever it runs, does not catch it reliably.",
  },
  {
    // Lesson table row "Emulation or FPGA prototyping"; quiz question 10, option 2 feedback.
    id: "boot-hang",
    glyph: "5",
    label: "A driver that hangs at boot",
    short: "Boot or driver hang",
    catchers: ["emulation"],
    lessonEvidence: "Bugs only real software exposes: boot, drivers, performance",
    missedWhy: "Only real software exposes it, and the block-level checks run no software.",
  },
  {
    // Pitfall paragraph: the late stages "find what only they can find, such as
    // interactions between blocks and real software".
    id: "block-interaction",
    glyph: "6",
    label: "A bug in how two blocks interact",
    short: "Block interaction",
    catchers: ["emulation"],
    lessonEvidence: "interactions between blocks and real software",
    missedWhy: "Block-level checks see one block at a time; the interaction exists only once the blocks run together.",
  },
];

export function bug(id: BugId): BugKind {
  const found = BUGS.find((b) => b.id === id);
  if (!found) throw new Error(`Unknown bug kind ${id}`);
  return found;
}

/** Bug kinds that only the late, pre-tape-out stage catches (the pitfall paragraph). */
export function lateOnlyBugs(): BugKind[] {
  return BUGS.filter((b) => b.catchers.every((c) => activity(c).stage === "integration"));
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */

export type PlacementKind = "earliest" | "moved" | "escaped";

export interface Placement {
  bug: BugKind;
  kind: PlacementKind;
  /** The activity that finds it, or null when it passes the tape-out line. */
  catcher: Activity | null;
  earliest: Activity;
  stage: TimelineStageId;
  /** "×10"; "×1,000 or more" after tape-out. */
  multiplierText: string;
  /** Cost at the landing stage divided by the cost at the earliest catcher (a lower bound after tape-out). */
  ratioVsEarliest: number;
  /**
   * True when the token moved to a later pre-tape-out catcher. The token shows
   * the best case; the schedule-slip reveal adds that bugs of this kind which
   * only the lab or a customer will hit go past the tape-out line.
   */
  mayStillEscape: boolean;
  sentence: string;
}

export type EnabledSet = ReadonlySet<ActivityId> | readonly ActivityId[];

function isEnabled(enabled: EnabledSet, id: ActivityId): boolean {
  return Array.isArray(enabled) ? enabled.includes(id) : (enabled as ReadonlySet<ActivityId>).has(id);
}

/** Cost-ladder stage a timeline lane is charged at (the lab, as a lower bound, after tape-out). */
function chargedCostStage(stage: TimelineStageId): CostStage["id"] {
  return timelineStage(stage).costStages[0];
}

function times(n: number): string {
  return `${n.toLocaleString("en-US")} times`;
}

/** "a", "a and b", "a, b and c". */
export function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "×1,000 or more": the lab's multiplier as a lower bound for anything past tape-out. */
export function pastTapeOutText(): string {
  return `${formatMultiplier(costStage("post-silicon").multiplier)} or more`;
}

/**
 * The second half of the lesson's schedule-slip reveal, appended to every
 * moved token: a token is one kind, and some bugs of that kind only the lab or
 * a customer will hit.
 */
export function movedCaveat(): string {
  return `Bugs of this kind that only the lab or a customer will hit go past the dashed tape-out line (${pastTapeOutText()}); the token shows the best case.`;
}

/**
 * Moves one bug token to its earliest enabled reliable catcher (lesson table +
 * quiz question 10). With none enabled it passes the tape-out line: post-silicon
 * validation is not a toggle, and the lesson says those bugs go to "the lab or a
 * customer", "×1,000 or more". The model does not decide between the two.
 */
export function placeBug(id: BugId, enabled: EnabledSet): Placement {
  const b = bug(id);
  const earliest = activity(b.catchers[0]);
  const catcherId = b.catchers.find((c) => isEnabled(enabled, c)) ?? null;
  const catcher = catcherId ? activity(catcherId) : null;
  const stage: TimelineStageId = catcher ? catcher.stage : "after-tape-out";
  const kind: PlacementKind = catcher === null ? "escaped" : catcher.id === earliest.id ? "earliest" : "moved";
  const landed = costStage(chargedCostStage(stage));
  const ratioVsEarliest = costRatio(chargedCostStage(earliest.stage), landed.id);
  const multiplierText = kind === "escaped" ? pastTapeOutText() : formatMultiplier(landed.multiplier);
  const at = timelineStage(stage).phrase;

  let sentence: string;
  if (kind === "earliest") {
    sentence = `${b.short}: found by ${catcher!.inSentence} ${at} (${multiplierText}), its earliest reliable catcher.`;
  } else if (kind === "moved") {
    sentence =
      `${b.short}: ${earliest.inSentence} is off, so it moves right to ${catcher!.inSentence} ${at} (${multiplierText}), ` +
      `about ${times(ratioVsEarliest)} the cost at its earliest catcher. ${movedCaveat()}`;
  } else {
    const field = costStage("field");
    const why = b.missedWhy ? ` ${b.missedWhy}` : "";
    sentence =
      `${b.short}: no enabled activity catches it before tape-out, so it passes the tape-out line to the silicon lab (${formatMultiplier(landed.multiplier)}) ` +
      `or, if the lab misses it, the field (${formatMultiplier(field.multiplier)}): about ${times(ratioVsEarliest)} or more the cost at ${earliest.inSentence}.${why}`;
  }
  return { bug: b, kind, catcher, earliest, stage, multiplierText, ratioVsEarliest, mayStillEscape: kind === "moved", sentence };
}

/** Every token's placement, in BUGS order. */
export function runTimeline(enabled: EnabledSet): Placement[] {
  return BUGS.map((b) => placeBug(b.id, enabled));
}

/** Reveal order for the step-through: the predicted bug first, then the rest in BUGS order. */
export function revealOrder(focus: BugId): BugId[] {
  return [focus, ...BUGS.map((b) => b.id).filter((id) => id !== focus)];
}

export interface RunSummary {
  /** Bug kinds (tokens), not bugs, found before tape-out. */
  beforeTapeOut: number;
  afterTapeOut: number;
  /** Tokens found later than their earliest catcher (moved or escaped). */
  moved: number;
  /** Tokens moved to a later pre-tape-out catcher; some of their bugs may still pass tape-out. */
  mayStillEscape: number;
  sentence: string;
}

export function summarizeRun(placements: Placement[]): RunSummary {
  const afterTapeOut = placements.filter((p) => p.kind === "escaped").length;
  const beforeTapeOut = placements.length - afterTapeOut;
  const moved = placements.filter((p) => p.kind !== "earliest").length;
  const mayStillEscape = placements.filter((p) => p.mayStillEscape).length;
  const one = moved === 1;
  const escapeOne = mayStillEscape === 1;
  const sentence =
    `${beforeTapeOut} of ${placements.length} bug kinds are found before tape-out and ${afterTapeOut} pass the tape-out line. ` +
    (moved === 0
      ? "Every bug kind is found by its earliest reliable catcher."
      : `${moved} ${one ? "is" : "are"} found later than ${one ? "its" : "their"} earliest catcher: cutting an activity moved ${one ? "it" : "them"} right, it did not remove ${one ? "it" : "them"}.`) +
    (mayStillEscape === 0
      ? ""
      : ` That count is the best case: of the ${mayStillEscape} ${escapeOne ? "kind" : "kinds"} that moved to a later stage before tape-out, ` +
        `bugs that only the lab or a customer will hit go past the dashed tape-out line (${pastTapeOutText()}).`);
  return { beforeTapeOut, afterTapeOut, moved, mayStillEscape, sentence };
}

/**
 * The pitfall: with every early activity on and the late stage off, the
 * late-only bugs still pass tape-out. Returns null when the late stage is on.
 */
export function lateStageNote(enabled: EnabledSet): string | null {
  if (isEnabled(enabled, "emulation")) return null;
  const late = lateOnlyBugs();
  const list = joinAnd(late.map((b) => b.short.toLowerCase()));
  return `Only ${activity("emulation").inSentence} catches ${list} before tape-out. With it off they pass the tape-out line however many early activities run: shifting left does not remove the late stages.`;
}

/**
 * Shown under the summary once every token is placed: why a moved bug costs
 * more than the multiplier alone suggests. Each claim paraphrases the lesson's
 * cost table ("What the fix involves") and shift-left table; the test pins the
 * phrases it rests on, and the section title it points to.
 */
export const PUSH_FURTHER =
  "Push further: block-level simulation finds a one-block bug with full visibility and fast runs. Moved to full-chip simulation or emulation, " +
  "the same bug means debugging across many blocks and long software runs, then re-verifying every block the fix touches (the lesson's cost table). " +
  "The Push Further section, \"Expert: Shift-left trade-offs\", weighs what each early activity costs in return.";

/* ------------------------------------------------------------------ */
/* Prediction                                                          */
/* ------------------------------------------------------------------ */

export interface StagePrediction {
  id: TimelineStageId;
  label: string;
  correct: boolean;
  feedback: string;
}

/** Feedback for predicting that `id` lands at `predicted`, given the enabled activities. */
export function predictionFeedback(id: BugId, enabled: EnabledSet, predicted: TimelineStageId): string {
  const p = placeBug(id, enabled);
  if (predicted === p.stage) return p.sentence;
  const order = TIMELINE.map((s) => s.id);
  const predictedIndex = order.indexOf(predicted);
  const actualIndex = order.indexOf(p.stage);
  const at = timelineStage(predicted).phrase;

  if (predictedIndex > actualIndex) {
    const found = `${p.catcher!.label} is on and finds it first, ${timelineStage(p.stage).phrase} (${p.multiplierText})`;
    if (p.kind === "moved") {
      // Too late for the token, but the schedule-slip reveal's second half
      // agrees with the prediction for some bugs of this kind: do not deny it.
      return (
        `Partly right. The token lands earlier: ${p.earliest.inSentence} is off, and ${found}, ` +
        `the best case for this kind. ${movedCaveat()}`
      );
    }
    // Too late: its earliest reliable catcher is on and finds it first.
    return `${found}. Later stages never see it.`;
  }
  // Too early: either its catcher at that stage is off, or nothing there catches it reliably.
  const offHere = p.bug.catchers.map(activity).find((a) => a.stage === predicted && !isEnabled(enabled, a.id));
  if (offHere) {
    return `${offHere.label} would catch it ${at}, but it is switched off. Cutting it does not remove the bug; the bug moves right. ${p.sentence}`;
  }
  const runningHere = ACTIVITIES.filter((a) => a.stage === predicted && isEnabled(enabled, a.id));
  const runningText =
    runningHere.length === 0
      ? `${capitalize(at)}, no activity catches this kind reliably, even when switched on.`
      : runningHere.length === 1
        ? `${runningHere[0].label} runs ${at}, but it does not catch this kind reliably.`
        : `${capitalize(joinAnd(runningHere.map((a) => a.inSentence)))} run ${at}, but none of them catches this kind reliably.`;
  return `${runningText} ${p.sentence}`;
}

export function predictionOptions(id: BugId, enabled: EnabledSet): StagePrediction[] {
  const actual = placeBug(id, enabled).stage;
  return TIMELINE.map((s) => ({ id: s.id, label: s.label, correct: s.id === actual, feedback: predictionFeedback(id, enabled, s.id) }));
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export type ShiftLeftPresetId = "shift-left" | "schedule-slipped" | "late-stages" | "late-discovery";

export interface ShiftLeftPreset {
  id: ShiftLeftPresetId;
  label: string;
  enabled: ActivityId[];
  focus: BugId;
  /** Shown before the run; describes the set-up only, never the result. */
  setup: string;
}

export const PRESETS: ShiftLeftPreset[] = [
  {
    id: "shift-left",
    label: "Shift left: everything on",
    enabled: ALL_ACTIVITIES,
    focus: "latch-width",
    setup: "Every activity runs as early as it can.",
  },
  {
    // Lesson: "the schedule slips and the team drops lint and block simulation".
    // Its reveal sends those bugs to full-chip simulation or emulation and, for
    // the ones only the lab or a customer will hit, past tape-out: the moved
    // tokens show the first (best) case and their sentences name the second
    // (movedCaveat), which is also quiz question 4's answer. The lesson calls
    // this "the overhead mistake" only after the reveal, so the setup does not.
    id: "schedule-slipped",
    label: "Schedule slipped: cut lint and block regressions",
    enabled: ALL_ACTIVITIES.filter((a) => a !== "lint" && a !== "block-sim"),
    focus: "block-functional",
    setup: "The schedule slipped, and the team dropped lint and block-level simulation to save time.",
  },
  {
    // Lesson pitfall: "shifting left does not remove the late stages".
    id: "late-stages",
    label: "Late stages still matter",
    enabled: ALL_ACTIVITIES.filter((a) => a !== "emulation"),
    focus: "boot-hang",
    setup: "Every early activity runs, but full-chip simulation and emulation were skipped.",
  },
  {
    id: "late-discovery",
    label: "Everything off",
    enabled: [],
    focus: "spec-contradiction",
    setup: "Every activity is switched off.",
  },
];

export function findPreset(id: string | undefined): ShiftLeftPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** Changes whenever the run's inputs change, so a prediction is never carried across runs. */
export function configKey(enabled: EnabledSet, focus: BugId): string {
  return `${ALL_ACTIVITIES.filter((a) => isEnabled(enabled, a)).join(",")}|${focus}`;
}
