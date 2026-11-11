import { toHtml } from "hast-util-to-html";
import type { Root } from "hast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { remarkCallouts } from "@/lib/curriculum/remark-callouts";
import { rehypeLessonText } from "@/lib/curriculum/rehype-lesson-text";

/** Markdown to HTML with and without the plugin; the snippets are taken from real lessons. */
function render(markdown: string, withPlugin = true): string {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkCallouts).use(remarkRehype);
  if (withPlugin) processor.use(rehypeLessonText);
  return toHtml(processor.runSync(processor.parse(markdown)) as Root);
}

/** The text of an HTML string, as a reader (or the before/after lesson text guard) sees it. */
function textOf(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

const leadIns = (html: string) => Array.from(parse(html).querySelectorAll("strong[data-lead-in]")).map((node) => node.textContent);

// I-UVM-1B, Quick Take.
const QUICK_TAKE = [
  "- **What it is:** The **UVM factory** is the one object in a simulation that builds UVM objects and components on request.",
  "- **Why it matters:** The environment that builds your drivers and monitors should be written once and reused by every test.",
].join("\n");

describe("rehypeLessonText: lead-in labels", () => {
  it("tags a bold label that opens a list item and ends in a colon (I-UVM-1B Quick Take)", () => {
    const html = render(QUICK_TAKE);
    expect(leadIns(html)).toEqual(["What it is:", "Why it matters:"]);
    // "UVM factory" is bold in the middle of the sentence: left alone.
    const plain = Array.from(parse(html).querySelectorAll("strong:not([data-lead-in])")).map((node) => node.textContent);
    expect(plain).toEqual(["UVM factory"]);
  });

  it("tags a label that opens a paragraph, also inside a callout (F1A, B-AXI-2)", () => {
    expect(leadIns(render("**NRE versus recurring cost:** the mask set is paid once per design revision (NRE)."))).toEqual([
      "NRE versus recurring cost:",
    ]);
    const callout = render("> [!WARNING]\n> **Two common bugs:** computing WSTRB from AxSIZE alone, which picks the wrong lanes.");
    expect(leadIns(callout)).toEqual(["Two common bugs:"]);
  });

  it("tags the label of a loose list item, whose text sits in a paragraph", () => {
    expect(leadIns(render("- **Remember:** `item_done` never blocks.\n\n- **Also:** it is a function."))).toEqual(["Remember:", "Also:"]);
  });

  it("does not tag bold in the middle of a sentence, even when it ends in a colon", () => {
    expect(leadIns(render("That request is an **override:** a type override swaps a class everywhere."))).toEqual([]);
  });

  it("does not tag a bold run without a colon (F2A: '**X-masking.**', '**One type, two names.**')", () => {
    expect(leadIns(render("**X-masking.** A DUT register that reset never assigned still holds `'x`."))).toEqual([]);
    expect(leadIns(render("- **WRAP bursts must start aligned** to the transfer size."))).toEqual([]);
  });

  it("does not tag bold inside a table cell (A-UVM-8) or a heading", () => {
    const table = render(
      [
        "| Check | Scope |",
        "|---|---|",
        "| **Per-agent checks:** assertions in the agent's interface | one interface's protocol rules |",
      ].join("\n"),
    );
    expect(leadIns(table)).toEqual([]);
    expect(leadIns(render("### **Step one:** register the class"))).toEqual([]);
  });

  it("tags a short label whose colon sits just after the bold run (I-SV-3A, F4B)", () => {
    expect(leadIns(render("**Run it**: save the code as `tb_top.sv`."))).toEqual(["Run it"]);
    expect(leadIns(render("- **Merged**: hits from every test.\n- **local**: visible only inside the class."))).toEqual(["Merged", "local"]);
  });

  it("does not tag a long bold run before a colon, a period-ended label or a colon that does not follow directly", () => {
    expect(leadIns(render("**This sentence is bold for seven whole words**: then text."))).toEqual([]);
    expect(leadIns(render("**Debrief.** What went wrong: the clock."))).toEqual([]);
    expect(leadIns(render("**Merged** : spaced colon."))).toEqual([]);
  });
});

/** An MDX JSX element node, as remark-rehype hands MDX JSX to rehype plugins. */
function jsx(type: "mdxJsxFlowElement" | "mdxJsxTextElement", name: string, children: unknown[]) {
  return { type, name, attributes: [] as Array<{ type: string; name: string; value: unknown }>, children };
}

describe("rehypeLessonText: lead-in labels written as JSX (F1B cards)", () => {
  it("tags <p><strong>Symptom:</strong> …</p> and <li><strong>Merged</strong>: …</li>", () => {
    const symptom = jsx("mdxJsxTextElement", "strong", [{ type: "text", value: "Symptom:" }]);
    const inner = jsx("mdxJsxTextElement", "strong", [{ type: "text", value: "antecedent" }]);
    const merged = jsx("mdxJsxTextElement", "strong", [{ type: "text", value: "Merged" }]);
    const tree = {
      type: "root",
      children: [
        jsx("mdxJsxFlowElement", "div", [
          jsx("mdxJsxFlowElement", "p", [symptom, { type: "text", value: " the " }, inner, { type: "text", value: " never matches." }]),
          jsx("mdxJsxFlowElement", "ul", [jsx("mdxJsxFlowElement", "li", [merged, { type: "text", value: ": hits." }])]),
        ]),
      ],
    };
    (rehypeLessonText() as (tree: unknown) => void)(tree);
    expect(symptom.attributes).toEqual([{ type: "mdxJsxAttribute", name: "data-lead-in", value: "" }]);
    expect(merged.attributes).toEqual([{ type: "mdxJsxAttribute", name: "data-lead-in", value: "" }]);
    expect(inner.attributes).toEqual([]);
  });

  it("leaves a capitalised JSX component alone", () => {
    const strong = jsx("mdxJsxTextElement", "strong", [{ type: "text", value: "Label:" }]);
    const tree = { type: "root", children: [jsx("mdxJsxFlowElement", "Card", [strong])] };
    (rehypeLessonText() as (tree: unknown) => void)(tree);
    expect(strong.attributes).toEqual([]);
  });
});

describe("rehypeLessonText: the Expert tag", () => {
  it("wraps the word in an outlined tag and keeps the colon as hidden text (B-AXI-4)", () => {
    const html = render("### Expert: what an interconnect may legally change");
    const heading = parse(html).querySelector("h3")!;
    const tag = heading.querySelector("[data-expert-tag]")!;
    expect(tag.firstChild?.textContent).toBe("Expert");
    expect(tag.querySelector("[data-expert-colon]")?.textContent).toBe(":");
    expect(heading.textContent).toBe("Expert: what an interconnect may legally change");
  });

  it("keeps inline code after the prefix", () => {
    const heading = parse(render("### Expert: what `kill()` and `stop_sequences()` do")).querySelector("h3")!;
    expect(heading.querySelector("[data-expert-tag]")).not.toBeNull();
    expect(heading.querySelectorAll("code")).toHaveLength(2);
    expect(heading.textContent).toBe("Expert: what kill() and stop_sequences() do");
  });

  it("leaves other headings and running text alone", () => {
    expect(render("### Expertise in practice")).not.toContain("data-expert-tag");
    expect(render("### Push Further")).not.toContain("data-expert-tag");
    expect(render("Expert: not a heading.")).not.toContain("data-expert-tag");
  });
});

describe("rehypeLessonText never changes the text", () => {
  it.each([
    ["Quick Take", QUICK_TAKE],
    ["callout", "> [!IMPORTANT]\n> **A common interview mistake:** \"I'd use constrained random for everything.\""],
    ["expert heading", "## Push Further\n\n### Expert: phase jumping as a reset strategy, in detail\n\nText."],
    ["table", "| A | B |\n|---|---|\n| **x:** y | `z` |"],
    ["colon outside the bold", "- **Merged**: hits from every test."],
  ])("%s", (_name, markdown) => {
    expect(textOf(render(markdown))).toBe(textOf(render(markdown, false)));
  });
});
