/**
 * Places the page's practice block (flashcards "Reinforce the essentials" and
 * "Teach it back") inside the lesson, where the template puts practice
 * (G30-PAGE-V02): at the end of the "Practice & Reinforce" section, else just
 * before "References & Next Topics", else at the end of the lesson. A learner
 * who follows the in-content "Next:" link in References has passed it.
 *
 * The plugin inserts one JSX element, `<{name} level="2|3" />`, which the page
 * provides as a component. Its headings are H3 inside "Practice & Reinforce"
 * and H2 elsewhere. The element carries `data.tocEntries`, which
 * remarkHeadingIds adds to the "On this page" list at that position. Run this
 * plugin before remarkHeadingIds; it adds no markdown headings, so heading ids
 * are unchanged.
 */
import { headingText, type TocEntry } from "./remark-heading-ids";

interface AstAttribute {
  type: "mdxJsxAttribute";
  name: string;
  value: string;
}

interface AstNode {
  type: string;
  depth?: number;
  value?: string;
  name?: string;
  attributes?: AstAttribute[];
  children?: AstNode[];
  data?: Record<string, unknown>;
}

export interface PracticeSlotSection {
  /** The id the rendered heading uses; also the "On this page" anchor. */
  id: string;
  text: string;
}

export interface RemarkPracticeSlotOptions {
  /** Component name the page provides, for example "LessonPractice". */
  name: string;
  /** The headings the component renders, in order. */
  sections: readonly PracticeSlotSection[];
}

export interface PracticeSlotPlacement {
  parent: AstNode;
  index: number;
  /** True when the slot ends the "Practice & Reinforce" section. */
  withinPractice: boolean;
}

const PRACTICE_HEADING = /^practice\b/i;
const REFERENCES_HEADING = /^references\b/i;

function headingsWithParents(tree: AstNode): Array<{ node: AstNode; parent: AstNode; index: number }> {
  const found: Array<{ node: AstNode; parent: AstNode; index: number }> = [];
  const walk = (parent: AstNode) => {
    parent.children?.forEach((child, index) => {
      if (child.type === "heading") {
        found.push({ node: child, parent, index });
        return;
      }
      walk(child);
    });
  };
  walk(tree);
  return found;
}

/** Where the practice block goes in a lesson tree. */
export function findPracticeSlotPlacement(tree: AstNode): PracticeSlotPlacement {
  const headings = headingsWithParents(tree);
  const isH2Matching = (pattern: RegExp) => (entry: { node: AstNode }) =>
    entry.node.depth === 2 && pattern.test(headingText(entry.node).trim());

  const practice = headings.find(isH2Matching(PRACTICE_HEADING));
  if (practice) {
    const siblings = practice.parent.children ?? [];
    let index = practice.index + 1;
    while (index < siblings.length && !(siblings[index].type === "heading" && (siblings[index].depth ?? 7) <= 2)) {
      index += 1;
    }
    return { parent: practice.parent, index, withinPractice: true };
  }

  const references = headings.find(isH2Matching(REFERENCES_HEADING));
  if (references) return { parent: references.parent, index: references.index, withinPractice: false };

  return { parent: tree, index: tree.children?.length ?? 0, withinPractice: false };
}

export function remarkPracticeSlot(options: RemarkPracticeSlotOptions) {
  return (tree: AstNode) => {
    const placement = findPracticeSlotPlacement(tree);
    const depth: 2 | 3 = placement.withinPractice ? 3 : 2;
    const tocEntries: TocEntry[] = options.sections.map((section) => ({ ...section, depth, expert: false }));
    const slot: AstNode = {
      type: "mdxJsxFlowElement",
      name: options.name,
      attributes: [{ type: "mdxJsxAttribute", name: "level", value: String(depth) }],
      children: [],
      data: { tocEntries },
    };
    placement.parent.children = placement.parent.children ?? [];
    placement.parent.children.splice(placement.index, 0, slot);
  };
}
