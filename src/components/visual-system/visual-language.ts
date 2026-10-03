/**
 * Shared visual language for curriculum visuals. Every encoding pairs colour
 * with a non-colour cue (glyph, outline style, or text tag) so meaning
 * survives greyscale, colour-vision differences, and screen readers.
 * See docs/visual-learning/visual-language.md for the rationale.
 */

export type FourStateKind = "zero" | "one" | "unknown" | "highz" | "vector";

export function classifyValue(value: number | string | undefined): FourStateKind {
  if (value === undefined || value === "X" || value === "x") return "unknown";
  if (value === "Z" || value === "z") return "highz";
  if (value === 0 || value === "0") return "zero";
  if (value === 1 || value === "1") return "one";
  return "vector";
}

/** Value chips: 0 is low/dim, 1 is bright, X is red + hatched, Z is amber + dashed. */
export const valueStyles: Record<FourStateKind, { className: string; cue: string }> = {
  zero: {
    className: "border-slate-400/60 bg-slate-500/15 text-slate-700 dark:text-slate-200",
    cue: "logic 0",
  },
  one: {
    className: "border-cyan-500/70 bg-cyan-500/15 text-cyan-800 dark:text-cyan-200",
    cue: "logic 1",
  },
  unknown: {
    className:
      "border-rose-500/80 text-rose-700 dark:text-rose-200 bg-[repeating-linear-gradient(135deg,rgba(244,63,94,0.18)_0_4px,transparent_4px_8px)]",
    cue: "unknown (X)",
  },
  highz: {
    className: "border-dashed border-amber-500/80 bg-amber-500/10 text-amber-800 dark:text-amber-200",
    cue: "high impedance (Z)",
  },
  vector: {
    className: "border-indigo-400/60 bg-indigo-500/10 text-indigo-800 dark:text-indigo-100",
    cue: "value",
  },
};

export type OwnerKind = "design" | "testbench" | "clock";

/** Design code is drawn square with a DUT tag; testbench code is rounded with a TB tag. */
export const ownerStyles: Record<OwnerKind, { tag: string; className: string; dot: string }> = {
  design: {
    tag: "DUT",
    className: "rounded-sm border-violet-500/60 bg-violet-500/10 text-violet-800 dark:text-violet-100",
    dot: "bg-violet-500",
  },
  testbench: {
    tag: "TB",
    className: "rounded-full border-amber-500/60 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    dot: "bg-amber-500",
  },
  clock: {
    tag: "CLK",
    className: "rounded-sm border-slate-400/60 bg-slate-500/10 text-slate-700 dark:text-slate-200",
    dot: "bg-slate-400",
  },
};

/** Scheduler region families. Read-only regions are dashed. */
export const regionFamilyStyles = {
  readOnly: { stroke: "stroke-slate-400", fill: "fill-slate-500/10", dash: "4 3", label: "read-only" },
  activeSet: { stroke: "stroke-cyan-500", fill: "fill-cyan-500/10", dash: undefined, label: "active region set" },
  reactiveSet: { stroke: "stroke-violet-500", fill: "fill-violet-500/10", dash: undefined, label: "reactive region set" },
} as const;

/** Expected vs actual: expected is outlined (EXP), actual is solid (ACT), mismatch adds ✕. */
export const comparisonStyles = {
  expected: { tag: "EXP", className: "border-dashed border-teal-500/70 text-teal-800 dark:text-teal-200" },
  actual: { tag: "ACT", className: "border-solid border-sky-500/70 bg-sky-500/10 text-sky-800 dark:text-sky-100" },
  match: { glyph: "✓", className: "text-emerald-700 dark:text-emerald-300" },
  mismatch: { glyph: "✕", className: "text-rose-700 dark:text-rose-300" },
} as const;

/**
 * Fidelity labels. Every visual must declare one so learners know whether
 * they are looking at an illustration, a rule-based model, or real tools.
 */
export type Fidelity = "illustration" | "model" | "simulator";

export const fidelityLabels: Record<Fidelity, { title: string; description: string; className: string }> = {
  illustration: {
    title: "Conceptual illustration",
    description: "A drawing of the idea. It does not execute anything.",
    className: "border-slate-400/50 bg-slate-500/10 text-slate-700 dark:text-slate-200",
  },
  model: {
    title: "Deterministic educational model",
    description: "Rule-based model of the stated semantics. Tested, but not a simulator.",
    className: "border-cyan-500/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-100",
  },
  simulator: {
    title: "Actual simulator execution",
    description: "Output produced by a real SystemVerilog simulator.",
    className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100",
  },
};

/** Line conventions used by SVG diagrams. */
export const lineConventions = {
  /** Containment / hierarchy: thin solid, no arrowhead. */
  structural: { strokeDasharray: undefined, marker: "none" },
  /** Data or transaction flow: solid with filled arrowhead. */
  dataFlow: { strokeDasharray: undefined, marker: "arrow" },
  /** Execution order or causality: dashed with open arrowhead and a verb label. */
  causal: { strokeDasharray: "6 4", marker: "open-arrow" },
} as const;
