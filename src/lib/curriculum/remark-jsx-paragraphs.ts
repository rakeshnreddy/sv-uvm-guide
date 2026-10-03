/**
 * MDX 2 parses indented text inside a block-level JSX element as markdown, so
 *   <p className="…">
 *     Some text
 *   </p>
 * compiles to <p><p>Some text</p></p>. Browsers repair the nested paragraph
 * differently from React, which causes hydration errors. For JSX elements
 * whose content model is phrasing-only, unwrap the generated paragraphs.
 */

interface AstNode {
  type: string;
  name?: string | null;
  children?: AstNode[];
}

const PHRASING_ONLY = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "summary", "span", "strong", "em", "code", "label", "button", "a"]);

function unwrap(node: AstNode): void {
  if (node.type === "mdxJsxFlowElement" && node.name && PHRASING_ONLY.has(node.name) && node.children) {
    node.children = node.children.flatMap((child, index) => {
      if (child.type !== "paragraph") return [child];
      const inner = child.children ?? [];
      // Keep a separating space between consecutive paragraphs that are merged.
      return index > 0 ? [{ type: "text", value: " " } as AstNode, ...inner] : inner;
    });
  }
  node.children?.forEach(unwrap);
}

export function remarkJsxParagraphs() {
  return (tree: AstNode) => unwrap(tree);
}
