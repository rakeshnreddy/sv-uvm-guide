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
      className: ["callout", `callout-${kind.toLowerCase()}`],
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
