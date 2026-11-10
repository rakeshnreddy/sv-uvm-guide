import type { ConceptNode } from "@/lib/knowledge-graph-engine";

interface AstAttribute {
  type: "mdxJsxAttribute";
  name: string;
  value: string;
}

interface AstNode {
  type: string;
  value?: string;
  name?: string;
  attributes?: AstAttribute[];
  children?: AstNode[];
}

const skippedNodeTypes = new Set([
  "code",
  "inlineCode",
  "heading",
  "link",
  "linkReference",
  "definition",
  "html",
  "mdxjsEsm",
  "mdxFlowExpression",
  "mdxTextExpression",
  "mdxJsxFlowElement",
  "mdxJsxTextElement",
]);

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function conceptElement(concept: ConceptNode, label: string): AstNode {
  return {
    type: "mdxJsxTextElement",
    name: "ConceptLink",
    attributes: [{ type: "mdxJsxAttribute", name: "conceptId", value: concept.id }],
    children: [{ type: "text", value: label }],
  };
}

function linkText(
  value: string,
  conceptsByName: ReadonlyMap<string, ConceptNode>,
  matcher: RegExp,
  linked: Set<string>,
): AstNode[] {
  const result: AstNode[] = [];
  let cursor = 0;

  for (const match of value.matchAll(matcher)) {
    const index = match.index;
    const label = match[0];
    if (index > cursor) result.push({ type: "text", value: value.slice(cursor, index) });

    // Only the first occurrence of each concept in a lesson becomes a link;
    // later ones stay plain text so generic words ("queue", "driver") do not
    // turn a page into a sea of links.
    const concept = conceptsByName.get(label.toLocaleLowerCase());
    if (concept && !linked.has(concept.id)) {
      linked.add(concept.id);
      result.push(conceptElement(concept, label));
    } else {
      result.push({ type: "text", value: label });
    }
    cursor = index + label.length;
  }

  if (cursor < value.length) result.push({ type: "text", value: value.slice(cursor) });
  return result.length > 0 ? result : [{ type: "text", value }];
}

function transformChildren(
  parent: AstNode,
  ancestors: readonly AstNode[],
  conceptsByName: ReadonlyMap<string, ConceptNode>,
  matcher: RegExp,
  linked: Set<string>,
): void {
  if (!parent.children || skippedNodeTypes.has(parent.type)) return;

  const nextAncestors = [...ancestors, parent];
  const isEligibleProse = nextAncestors.some((node) => node.type === "paragraph" || node.type === "tableCell");
  const transformed: AstNode[] = [];

  for (const child of parent.children) {
    if (child.type === "text" && child.value && isEligibleProse) {
      transformed.push(...linkText(child.value, conceptsByName, matcher, linked));
      continue;
    }

    transformChildren(child, nextAncestors, conceptsByName, matcher, linked);
    transformed.push(child);
  }

  parent.children = transformed;
}

/**
 * Wraps the first occurrence of each concept name in lesson prose with
 * <ConceptLink>. Opt-in per lesson: the lesson page runs it only when the
 * frontmatter sets `conceptLinking: true`, with the key terms from
 * getLinkableConcepts().
 */
export function remarkConceptLinks({ concepts }: { concepts: readonly ConceptNode[] }) {
  const uniqueConcepts = new Map(
    concepts
      .filter((concept) => concept.name.trim().length > 0)
      .map((concept) => [concept.name.toLocaleLowerCase(), concept] as const),
  );
  const alternatives = [...uniqueConcepts.values()]
    .map((concept) => concept.name)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegularExpression);

  if (alternatives.length === 0) return () => undefined;

  const matcher = new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}_])`,
    "giu",
  );

  return (tree: AstNode) => {
    transformChildren(tree, [], uniqueConcepts, matcher, new Set<string>());
  };
}
