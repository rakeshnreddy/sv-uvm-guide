/**
 * Turns GitHub-style alert blockquotes (`> [!NOTE]`, `> [!WARNING]`, …) into
 * labelled callout asides. remark-gfm v3 does not implement alerts, so without
 * this plugin the marker text renders literally inside a plain blockquote.
 */

interface AstNode {
  type: string;
  value?: string;
  children?: AstNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

export const calloutKinds = {
  NOTE: "Note",
  TIP: "Tip",
  IMPORTANT: "Important",
  WARNING: "Warning",
  CAUTION: "Caution",
} as const;

type CalloutKind = keyof typeof calloutKinds;

/**
 * The colour role of a callout (DESIGN.md section 12): note or info is the
 * accent, tip is success, pitfall or warning the warning colour, danger the
 * danger colour, and standard or reference the --reference role. GitHub's
 * IMPORTANT (purple there) is the reference role; CAUTION is danger. Any other
 * kind is a note.
 */
export type CalloutRole = "note" | "tip" | "warning" | "danger" | "reference";

const CALLOUT_ROLES: Readonly<Record<string, CalloutRole>> = {
  note: "note",
  info: "note",
  tip: "tip",
  warning: "warning",
  pitfall: "warning",
  danger: "danger",
  caution: "danger",
  standard: "reference",
  reference: "reference",
  important: "reference",
};

export function calloutRole(kind: string): CalloutRole {
  return CALLOUT_ROLES[kind.trim().toLowerCase()] ?? "note";
}

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;

function transformBlockquote(node: AstNode): void {
  const paragraph = node.children?.[0];
  const firstText = paragraph?.type === "paragraph" ? paragraph.children?.[0] : undefined;
  if (!firstText || firstText.type !== "text" || typeof firstText.value !== "string") return;
  const match = MARKER.exec(firstText.value);
  if (!match) return;

  const kind = match[1] as CalloutKind;
  firstText.value = firstText.value.slice(match[0].length).replace(/^\n/, "");
  if (!firstText.value && paragraph?.children) paragraph.children.shift();
  if (paragraph && paragraph.children?.length === 0) node.children?.shift();

  node.children?.unshift({
    type: "paragraph",
    data: { hName: "p", hProperties: { className: ["callout-label"] } },
    children: [{ type: "text", value: calloutKinds[kind] }],
  });
  node.data = {
    hName: "aside",
    hProperties: {
      // glass-liquid: the lesson panels' liquid glass (globals.css), tinted by the role.
      className: ["callout", `callout-${kind.toLowerCase()}`, "glass-liquid"],
      "data-callout-role": calloutRole(kind),
      role: "note",
      "aria-label": calloutKinds[kind],
    },
  };
}

function visit(node: AstNode): void {
  if (node.type === "blockquote") transformBlockquote(node);
  node.children?.forEach(visit);
}

export function remarkCallouts() {
  return (tree: AstNode) => visit(tree);
}
