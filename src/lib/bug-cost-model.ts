/**
 * Illustrative bug-cost escalation for F1A. These are NOT measured data: the
 * multipliers encode the commonly cited order-of-magnitude rule of thumb
 * ("each later stage costs roughly ten times more"). Real costs vary widely
 * by product, process node, team and how the bug is found.
 *
 * Dollar figures are only ever computed as `anchor × multiplier`, where the
 * anchor is an assumption the learner chooses.
 */

export interface CostStage {
  id: "spec" | "rtl" | "system" | "post-silicon" | "field";
  label: string;
  /** Order-of-magnitude cost relative to fixing the same bug at spec review. */
  multiplier: number;
  /** What has to be redone when the bug is found here. */
  redo: string;
}

export const COST_STAGES: CostStage[] = [
  {
    id: "spec",
    label: "Spec review",
    multiplier: 1,
    redo: "Reword a requirement and tell the team. Nothing has been built yet.",
  },
  {
    id: "rtl",
    label: "RTL simulation",
    multiplier: 10,
    redo: "Debug the failing test, edit the RTL, rerun the block regression.",
  },
  {
    id: "system",
    label: "Full-chip / emulation",
    multiplier: 100,
    redo: "Debug across many blocks and long software runs, then re-verify every block the fix touches.",
  },
  {
    id: "post-silicon",
    label: "Post-silicon (lab)",
    multiplier: 1_000,
    redo: "Find the bug on real chips, then pay for new masks and wafers (a metal-only or full respin) or ship a firmware workaround. The product waits weeks to months.",
  },
  {
    id: "field",
    label: "In the field",
    multiplier: 10_000,
    redo: "Customers hit it. Recalls or replacements, emergency patches that may cost performance, and lost trust.",
  },
];

export function stageIndex(id: CostStage["id"]): number {
  return COST_STAGES.findIndex((s) => s.id === id);
}

/** How many times more a fix costs at `later` than at `earlier` (rule-of-thumb ratio). */
export function costRatio(earlier: CostStage["id"], later: CostStage["id"]): number {
  return COST_STAGES[stageIndex(later)].multiplier / COST_STAGES[stageIndex(earlier)].multiplier;
}

const UNITS: { value: number; suffix: string }[] = [
  { value: 1e12, suffix: "T" },
  { value: 1e9, suffix: "B" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" },
];

function trimDecimal(n: number): string {
  // Up to three significant figures, without trailing zeros: 1, 1.5, 12.5, 100.
  const s = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/**
 * Formats a dollar amount with K/M/B/T suffixes. Each suffix divides by its own
 * unit (the old graph divided $100M by 1e8 and printed "$1.0B+").
 */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  for (const unit of UNITS) {
    if (value >= unit.value) return `$${trimDecimal(value / unit.value)}${unit.suffix}`;
  }
  return `$${Math.round(value)}`;
}

/** Formats a multiplier as ×1, ×10, ×1,000, ×10,000. */
export function formatMultiplier(m: number): string {
  return `×${m.toLocaleString("en-US")}`;
}

/** Illustrative cost at a stage given the learner's anchor (cost at spec review). */
export function illustrativeCost(stage: CostStage, anchorUsd: number): number {
  return anchorUsd * stage.multiplier;
}

export const ANCHOR_OPTIONS = [100, 1_000, 10_000] as const;
export type AnchorUsd = (typeof ANCHOR_OPTIONS)[number];
