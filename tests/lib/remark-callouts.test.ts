import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";

import { remarkCallouts } from "@/lib/curriculum/remark-callouts";

const run = (md: string) => {
  const processor = unified().use(remarkParse).use(remarkCallouts);
  return processor.runSync(processor.parse(md)) as any;
};

describe("remarkCallouts", () => {
  it("converts a GitHub alert blockquote into a labelled aside and strips the marker", () => {
    const tree = run("> [!WARNING]\n> Never drive DUT inputs with `=` at the clock edge.");
    const quote = tree.children[0];
    expect(quote.data.hName).toBe("aside");
    expect(quote.data.hProperties.className).toEqual(["callout", "callout-warning"]);
    expect(quote.children[0].children[0].value).toBe("Warning");
    const body = JSON.stringify(quote.children.slice(1));
    expect(body).not.toContain("[!WARNING]");
    expect(body).toContain("Never drive DUT inputs with");
  });

  it("leaves ordinary blockquotes untouched", () => {
    const tree = run("> Just a quote.");
    expect(tree.children[0].data).toBeUndefined();
  });
});
