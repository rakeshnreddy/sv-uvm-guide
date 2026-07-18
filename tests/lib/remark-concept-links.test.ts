import { describe, expect, it } from "vitest";

import { remarkConceptLinks } from "@/lib/curriculum/remark-concept-links";

const concepts = [{
  id: "data-types",
  name: "Data Types",
  description: "SystemVerilog data types",
  tier: "Foundational" as const,
}];

function conceptLinks(node: any): any[] {
  const own = node.type === "mdxJsxTextElement" && node.name === "ConceptLink" ? [node] : [];
  return [...own, ...(node.children ?? []).flatMap(conceptLinks)];
}

describe("remarkConceptLinks", () => {
  it("links eligible prose while preserving code, headings, links, and JSX", () => {
    const tree: any = {
      type: "root",
      children: [
        { type: "heading", children: [{ type: "text", value: "Data Types" }] },
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Learn Data Types before " },
            { type: "inlineCode", value: "Data Types" },
            { type: "text", value: " and keep " },
            { type: "link", url: "/curriculum", children: [{ type: "text", value: "Data Types" }] },
            { type: "text", value: "." },
          ],
        },
        { type: "code", value: "Data Types" },
        {
          type: "mdxJsxFlowElement",
          name: "Panel",
          children: [{ type: "paragraph", children: [{ type: "text", value: "Data Types" }] }],
        },
      ],
    };

    remarkConceptLinks({ concepts })(tree);

    expect(conceptLinks(tree)).toHaveLength(1);
    expect(conceptLinks(tree)[0].attributes).toContainEqual(
      expect.objectContaining({ name: "conceptId", value: "data-types" }),
    );
    expect(tree.children[0].children[0].value).toBe("Data Types");
    expect(tree.children[1].children.some((node: any) => node.type === "inlineCode")).toBe(true);
    expect(tree.children[2].value).toBe("Data Types");
    expect(tree.children[3].children[0].children[0].value).toBe("Data Types");
  });
});
