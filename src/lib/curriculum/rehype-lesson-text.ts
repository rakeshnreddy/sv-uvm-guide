/**
 * Build-time tagging for the lesson text hierarchy (DESIGN.md section 12).
 * Lessons are never edited for it: this plugin only adds attributes and
 * wrapper spans, so the text of every lesson stays exactly as written.
 *
 * - Lead-in labels: a bold label that opens a paragraph or a list item and
 *   ends in a colon gets `data-lead-in`, which globals.css colours with the
 *   lesson's tier. The colon may sit inside the bold ("**What it is:** …") or
 *   straight after it ("**Merged**: hits from …", for a label of at most six
 *   words). Markdown paragraphs and list items count, and so do `<p>` and
 *   `<li>` written as JSX in a lesson (F1B's "Symptom:" cards). Bold in the
 *   middle of a sentence, a bold run without a colon ("**Debrief.**"), and
 *   bold in a table cell or a heading are left alone.
 * - Expert headings: a heading whose text starts with "Expert:" has the word
 *   wrapped in an outlined tag (`data-expert-tag`) and the colon in a span
 *   that is hidden on screen but still read and copied, so the heading reads
 *   "[Expert] What …" and its text is unchanged.
 */

interface HastNode {
  type: string;
  tagName?: string;
  /** The element name of an MDX JSX element (`mdxJsxFlowElement`, `mdxJsxTextElement`). */
  name?: string | null;
  value?: string;
  properties?: Record<string, unknown>;
  /** The attributes of an MDX JSX element. */
  attributes?: Array<{ type: string; name?: string; value?: unknown }>;
  children?: HastNode[];
}

/** The attribute a tagged lead-in label carries. */
export const LEAD_IN_ATTRIBUTE = "data-lead-in";
/** The attribute on the outlined "Expert" tag inside an expert heading. */
export const EXPERT_TAG_ATTRIBUTE = "data-expert-tag";
/** The attribute on the colon after the tag, hidden on screen only. */
export const EXPERT_COLON_ATTRIBUTE = "data-expert-colon";

const LEAD_IN_PARENTS = new Set(["p", "li"]);
const HEADINGS = new Set(["h2", "h3", "h4", "h5", "h6"]);
const EXPERT_PREFIX = /^Expert(:)/;
/** The longest label, in words, whose colon may sit just outside the bold run. */
export const LEAD_IN_MAX_WORDS = 6;

const JSX_ELEMENTS = new Set(["mdxJsxFlowElement", "mdxJsxTextElement"]);

function isElement(node: HastNode | undefined, tagName?: string): node is HastNode & { tagName: string } {
  return Boolean(node && node.type === "element" && (tagName === undefined || node.tagName === tagName));
}

/** The tag name of an HTML element or of a lowercase JSX element written in a lesson (`<p>`, `<strong>`); otherwise null. */
function tagNameOf(node: HastNode | undefined): string | null {
  if (!node) return null;
  if (node.type === "element") return node.tagName ?? null;
  if (JSX_ELEMENTS.has(node.type) && node.name && /^[a-z]/.test(node.name)) return node.name;
  return null;
}

function setFlag(node: HastNode, attribute: string): void {
  if (node.type === "element") {
    node.properties = { ...node.properties, [attribute]: "" };
    return;
  }
  const attributes = node.attributes ?? [];
  if (!attributes.some((entry) => entry.name === attribute)) {
    node.attributes = [...attributes, { type: "mdxJsxAttribute", name: attribute, value: "" }];
  }
}

function isBlankText(node: HastNode): boolean {
  return node.type === "text" && !(node.value ?? "").trim();
}

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

/** The first child that is not whitespace-only text. */
function firstContentChild(node: HastNode): HastNode | undefined {
  return (node.children ?? []).find((child) => !isBlankText(child));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * True when `strong` opens `parent` (a paragraph or list item) and ends in a
 * colon, or is a label of at most LEAD_IN_MAX_WORDS words followed directly by
 * text that starts with a colon.
 */
export function isLeadInLabel(parent: HastNode, strong: HastNode): boolean {
  const parentTag = tagNameOf(parent);
  if (!parentTag || !LEAD_IN_PARENTS.has(parentTag)) return false;
  if (tagNameOf(strong) !== "strong") return false;
  if (firstContentChild(parent) !== strong) return false;
  const label = textOf(strong).trim();
  if (!label) return false;
  if (label.endsWith(":")) return true;
  const siblings = parent.children ?? [];
  const next = siblings[siblings.indexOf(strong) + 1];
  return Boolean(next && next.type === "text" && (next.value ?? "").startsWith(":") && wordCount(label) <= LEAD_IN_MAX_WORDS);
}

function tagLeadIn(parent: HastNode): void {
  const first = firstContentChild(parent);
  if (first && isLeadInLabel(parent, first)) setFlag(first, LEAD_IN_ATTRIBUTE);
}

function tagExpertHeading(heading: HastNode): void {
  const children = heading.children ?? [];
  const index = children.findIndex((child) => !isBlankText(child));
  const first = children[index];
  if (!first || first.type !== "text") return;
  const value = first.value ?? "";
  const leading = value.slice(0, value.length - value.trimStart().length);
  const match = EXPERT_PREFIX.exec(value.trimStart());
  if (!match) return;
  const rest = value.trimStart().slice("Expert:".length);
  const replacement: HastNode[] = [
    ...(leading ? [{ type: "text", value: leading }] : []),
    {
      type: "element",
      tagName: "span",
      properties: { [EXPERT_TAG_ATTRIBUTE]: "" },
      children: [
        { type: "text", value: "Expert" },
        { type: "element", tagName: "span", properties: { [EXPERT_COLON_ATTRIBUTE]: "" }, children: [{ type: "text", value: ":" }] },
      ],
    },
    ...(rest ? [{ type: "text", value: rest }] : []),
  ];
  children.splice(index, 1, ...replacement);
}

function visit(node: HastNode): void {
  const tagName = tagNameOf(node);
  if (tagName && LEAD_IN_PARENTS.has(tagName)) tagLeadIn(node);
  if (isElement(node) && HEADINGS.has(node.tagName)) tagExpertHeading(node);
  node.children?.forEach(visit);
}

/** The rehype plugin. */
export function rehypeLessonText() {
  return (tree: HastNode) => visit(tree);
}
