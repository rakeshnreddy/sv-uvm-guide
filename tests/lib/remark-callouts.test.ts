import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";

import { calloutRole, remarkCallouts } from "@/lib/curriculum/remark-callouts";

const run = (md: string) => {
  const processor = unified().use(remarkParse).use(remarkCallouts);
  return processor.runSync(processor.parse(md)) as any;
};

describe("remarkCallouts", () => {
  it("converts a GitHub alert blockquote into a labelled aside and strips the marker", () => {
    const tree = run("> [!WARNING]\n> Never drive DUT inputs with `=` at the clock edge.");
    const quote = tree.children[0];
    expect(quote.data.hName).toBe("aside");
    expect(quote.data.hProperties.className).toEqual(["callout", "callout-warning", "glass-liquid"]);
    expect(quote.data.hProperties["data-callout-role"]).toBe("warning");
    expect(quote.children[0].children[0].value).toBe("Warning");
    const body = JSON.stringify(quote.children.slice(1));
    expect(body).not.toContain("[!WARNING]");
    expect(body).toContain("Never drive DUT inputs with");
  });

  it("leaves ordinary blockquotes untouched", () => {
    const tree = run("> Just a quote.");
    expect(tree.children[0].data).toBeUndefined();
  });

  it.each([
    ["NOTE", "note"],
    ["TIP", "tip"],
    ["IMPORTANT", "reference"],
    ["WARNING", "warning"],
    ["CAUTION", "danger"],
  ])("gives > [!%s] the %s role", (kind, role) => {
    const tree = run(`> [!${kind}]\n> Body.`);
    expect(tree.children[0].data.hProperties["data-callout-role"]).toBe(role);
  });
});

describe("calloutRole", () => {
  it("maps every kind section 12 names to its role, ignoring case", () => {
    expect(calloutRole("note")).toBe("note");
    expect(calloutRole("Info")).toBe("note");
    expect(calloutRole("tip")).toBe("tip");
    expect(calloutRole("pitfall")).toBe("warning");
    expect(calloutRole("WARNING")).toBe("warning");
    expect(calloutRole("danger")).toBe("danger");
    expect(calloutRole("caution")).toBe("danger");
    expect(calloutRole("standard")).toBe("reference");
    expect(calloutRole("reference")).toBe("reference");
    expect(calloutRole("important")).toBe("reference");
  });

  it("treats an unknown kind as a note", () => {
    expect(calloutRole("aside")).toBe("note");
    expect(calloutRole("")).toBe("note");
  });
});
