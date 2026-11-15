/**
 * Figure colours for the diagram kit (DESIGN.md section 13). Every class here
 * reads a figure token from globals.css (fig-<hue>: stroke, fig-<hue>-text,
 * fig-<hue>-fill), so a figure adapts to light and dark and holds the contrast
 * floor that tests/app/theme-contrast.test.ts enforces. The meanings are the
 * visual language's (visual-language.ts); this file only says which hue and
 * shape each role takes in a drawing. Class names are written out in full so
 * Tailwind finds them.
 */
import type { DiagramNodeKind, EdgeStyle, NodeState } from "./BlockDiagram";

/** What a node kind means in a figure. "generic" has no role and carries no meaning. */
export type FigureRole = "design" | "testbench" | "interface" | "register" | "generic";

/**
 * A text-free colour role an author can give a node or participant (`role:`
 * in the figure data). It takes the role's colour and corner shape but adds no
 * tag and changes no text, so a lesson figure can be coloured without changing
 * its words (DESIGN.md section 13, "Assigning roles in lessons").
 *
 * Only design and testbench may be given this way: their corner shape (square,
 * pill) is a non-colour cue. Interface and register draw with the same radius
 * as a neutral box, so without their IF or REG tag they would differ by colour
 * alone; they stay with the tagged kinds.
 */
export type AssignedRole = "design" | "testbench";

export const ASSIGNABLE_ROLES: readonly AssignedRole[] = ["design", "testbench"];

/** Words for a role, used in accessible names and descriptions when the role has no tag. */
export const roleWords: Record<AssignedRole, string> = {
  design: "design side",
  testbench: "testbench side",
};

export function isAssignedRole(value: unknown): value is AssignedRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

/**
 * The role a node is drawn in: the role of its kind when the kind has one (its
 * tag says it), else its assigned role. A value that is not a role is ignored
 * here and reported by the layout as a data error (roleProblem), so a typo
 * never breaks the drawing.
 */
export function effectiveRole(kind: DiagramNodeKind | undefined, role?: AssignedRole): FigureRole {
  const own = figureRoleOf(kind);
  if (own !== "generic") return own;
  return isAssignedRole(role) ? role : "generic";
}

/**
 * The role words to say for a node whose role comes from `role` rather than
 * from a tagged kind (a kind's tag already says it), or null.
 */
export function assignedRoleWords(kind: DiagramNodeKind | undefined, role: AssignedRole | undefined): string | null {
  if (!role || figureRoleOf(kind) !== "generic") return null;
  return isAssignedRole(role) ? roleWords[role] : null;
}

/**
 * A data error for a `role` value, or null: the value must be one of
 * ASSIGNABLE_ROLES, and on a node whose kind already has a role it must agree
 * with it (a DRV tag drawn violet would contradict itself).
 */
export function roleProblem(subject: string, kind: DiagramNodeKind | undefined, role: unknown): string | null {
  if (role === undefined) return null;
  if (!isAssignedRole(role)) return `${subject} has role "${String(role)}"; use one of ${ASSIGNABLE_ROLES.map((r) => `"${r}"`).join(", ")}.`;
  const own = figureRoleOf(kind);
  if (own !== "generic" && own !== role) return `${subject} has kind "${kind}" (${own}) but role "${role}"; drop the role or make them agree.`;
  return null;
}

export function figureRoleOf(kind: DiagramNodeKind | undefined): FigureRole {
  switch (kind) {
    case "dut":
      return "design";
    case "interface":
      return "interface";
    case "reg":
      return "register";
    case "generic":
    case undefined:
      return "generic";
    default:
      return "testbench";
  }
}

export interface RoleStyle {
  /** Leaf box: soft fill and stroke. */
  box: string;
  /** Container: a fainter tint and the role stroke (drawn dashed). */
  container: string;
  /** Tag chip behind the role tag (DUT, DRV, IF…). */
  chip: string;
  /** Tag text and the container name. */
  tagText: string;
  /** A container inside another container: no fill, so nested testbench tints do not stack. */
  containerNested: string;
  /** Corner radius: design is square, testbench a rounded pill, the rest in between. */
  radius: number;
  containerRadius: number;
  /** Lifeline in sequence diagrams: a faint version of the role colour. */
  lifeline: string;
  /** Legend swatch fill (HTML). */
  swatch: string;
  legend: string | null;
}

export const roleStyles: Record<FigureRole, RoleStyle> = {
  design: {
    box: "fill-fig-violet-fill stroke-fig-violet",
    container: "fill-fig-violet/[0.05] stroke-fig-violet",
    containerNested: "fill-none stroke-fig-violet",
    chip: "fill-fig-violet-fill",
    tagText: "fill-fig-violet-text",
    radius: 3,
    containerRadius: 4,
    lifeline: "stroke-fig-violet/50",
    swatch: "rounded-[2px] border-fig-violet bg-fig-violet-fill",
    legend: "design (DUT)",
  },
  testbench: {
    box: "fill-fig-amber-fill stroke-fig-amber",
    container: "fill-fig-amber/[0.04] stroke-fig-amber",
    containerNested: "fill-none stroke-fig-amber",
    chip: "fill-fig-amber-fill",
    tagText: "fill-fig-amber-text",
    radius: 14,
    containerRadius: 16,
    lifeline: "stroke-fig-amber/50",
    swatch: "rounded-full border-fig-amber bg-fig-amber-fill",
    legend: "testbench",
  },
  interface: {
    box: "fill-fig-indigo-fill stroke-fig-indigo",
    container: "fill-fig-indigo/[0.05] stroke-fig-indigo",
    containerNested: "fill-none stroke-fig-indigo",
    chip: "fill-fig-indigo-fill",
    tagText: "fill-fig-indigo-text",
    radius: 8,
    containerRadius: 12,
    lifeline: "stroke-fig-indigo/50",
    swatch: "rounded-[4px] border-fig-indigo bg-fig-indigo-fill",
    legend: "interface",
  },
  register: {
    box: "fill-fig-teal-fill stroke-fig-teal",
    container: "fill-fig-teal/[0.05] stroke-fig-teal",
    containerNested: "fill-none stroke-fig-teal",
    chip: "fill-fig-teal-fill",
    tagText: "fill-fig-teal-text",
    radius: 8,
    containerRadius: 12,
    lifeline: "stroke-fig-teal/50",
    swatch: "rounded-[4px] border-fig-teal bg-fig-teal-fill",
    legend: "register model",
  },
  generic: {
    box: "fill-fig-generic-fill stroke-fig-generic",
    container: "fill-fig-generic-fill stroke-fig-generic",
    containerNested: "fill-none stroke-fig-generic",
    chip: "fill-fig-generic-fill",
    tagText: "fill-muted-foreground",
    radius: 8,
    containerRadius: 14,
    lifeline: "stroke-border",
    swatch: "",
    legend: null,
  },
};

/** Node states keep their meaning and win over the role colour. */
export const stateStyles: Record<Exclude<NodeState, "normal">, { box: string; chip: string; tagText: string }> = {
  active: { box: "fill-fig-cyan-fill stroke-fig-cyan", chip: "fill-fig-cyan-fill", tagText: "fill-fig-cyan-text" },
  error: { box: "fill-fig-rose-fill stroke-fig-rose", chip: "fill-fig-rose-fill", tagText: "fill-fig-rose-text" },
  ok: { box: "fill-fig-emerald-fill stroke-fig-emerald", chip: "fill-fig-emerald-fill", tagText: "fill-fig-emerald-text" },
  dim: { box: "fill-card/40 stroke-border opacity-50", chip: "fill-muted", tagText: "fill-muted-foreground" },
};

/**
 * Edge colour keys: one marker pair is drawn per key. Control has two: amber
 * where the line touches a testbench node (get_next_item, start, grab: amber is
 * the testbench colour), and the strong neutral elsewhere, so a select line
 * between design blocks never reads as testbench traffic. Both are dotted.
 */
export type EdgeTone = "data" | "control" | "controlPlain" | "causal" | "structural" | "active" | "error" | "dim";

export const edgeTones: Record<EdgeTone, { stroke: string; marker: string; markerStroke: string; chip: string; chipEdge: string; text: string }> = {
  // Data and transaction flow: indigo, the colour of multi-bit values.
  data: { stroke: "stroke-fig-indigo", marker: "fill-fig-indigo", markerStroke: "stroke-fig-indigo", chip: "fill-fig-indigo-fill", chipEdge: "stroke-fig-indigo/40", text: "fill-fig-indigo-text" },
  // Control (dotted) that touches a testbench node: amber, the testbench colour (get_next_item, start, grab).
  control: { stroke: "stroke-fig-amber", marker: "fill-fig-amber", markerStroke: "stroke-fig-amber", chip: "fill-fig-amber-fill", chipEdge: "stroke-fig-amber/40", text: "fill-fig-amber-text" },
  // Control (dotted) between nodes that are not testbench (a decoder's selects): the strong neutral.
  controlPlain: { stroke: "stroke-foreground/75", marker: "fill-foreground/75", markerStroke: "stroke-foreground/75", chip: "fill-muted", chipEdge: "stroke-border", text: "fill-foreground" },
  // Call order and causality (dashed): the strong neutral, so flowcharts stay calm.
  causal: { stroke: "stroke-foreground/75", marker: "fill-foreground/75", markerStroke: "stroke-foreground/75", chip: "fill-muted", chipEdge: "stroke-border", text: "fill-foreground" },
  // Structure and plain connections: the secondary neutral, no arrowhead.
  structural: { stroke: "stroke-muted-foreground", marker: "fill-muted-foreground", markerStroke: "stroke-muted-foreground", chip: "fill-muted", chipEdge: "stroke-border", text: "fill-foreground" },
  active: { stroke: "stroke-fig-cyan", marker: "fill-fig-cyan", markerStroke: "stroke-fig-cyan", chip: "fill-fig-cyan-fill", chipEdge: "stroke-fig-cyan/50", text: "fill-fig-cyan-text" },
  error: { stroke: "stroke-fig-rose", marker: "fill-fig-rose", markerStroke: "stroke-fig-rose", chip: "fill-fig-rose-fill", chipEdge: "stroke-fig-rose/50", text: "fill-fig-rose-text" },
  dim: { stroke: "stroke-foreground/25", marker: "fill-foreground/25", markerStroke: "stroke-foreground/25", chip: "fill-muted", chipEdge: "stroke-border", text: "fill-muted-foreground" },
};

/**
 * The colour key of an edge. `touchesTestbench` says whether either end is a
 * testbench node; it only matters for control lines.
 */
export function edgeToneOf(style: EdgeStyle, state: "normal" | "active" | "error" | "dim" | undefined, touchesTestbench = true): EdgeTone {
  if (state === "active" || state === "error" || state === "dim") return state;
  if (style === "control" && !touchesTestbench) return "controlPlain";
  return style;
}

/** Width of a tag chip for `tag` in 9 px mono (0.6 em per character) with 4 px padding each side. */
export function tagChipWidth(tag: string, fontSize = 9): number {
  return tag.length * fontSize * 0.6 + 8;
}
