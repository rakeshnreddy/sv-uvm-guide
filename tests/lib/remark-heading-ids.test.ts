import fs from "node:fs";
import path from "node:path";

import { compileSync } from "@mdx-js/mdx";
import matter from "gray-matter";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { componentLinkMap } from "@/components/diagrams/uvm-link-map";
import { curriculumData } from "@/lib/curriculum-data";
import { remarkHeadingIds, type TocEntry } from "@/lib/curriculum/remark-heading-ids";
import { createSlugger } from "@/lib/heading-slug";

const contentRoot = path.join(process.cwd(), "content", "curriculum");

/** Compiles MDX through remark-gfm and the plugin, as the lesson page does; returns the code and the TOC. */
function compileWithIds(source: string, extraPlugins: unknown[] = []) {
  const toc: TocEntry[] = [];
  const code = String(
    compileSync(source, {
      remarkPlugins: [remarkGfm, ...extraPlugins, [remarkHeadingIds, { toc }]] as never,
      development: false,
    }),
  );
  return { code, toc };
}

/** Ids the compiled lesson gives its headings, in order. */
function headingIds(code: string): string[] {
  return [...code.matchAll(/_components\.h[1-6], \{\s*id: "([^"]*)"/g)].map((match) => match[1]);
}

/**
 * The reference algorithm, written the way the search index
 * (scripts/generate-search-index.mjs) and the expert index (src/lib/expert-index.ts)
 * apply src/lib/heading-slug.ts: parse the body, take every heading in
 * document order, slug its text and inline code.
 */
function referenceAnchors(body: string): Array<{ depth: number; anchor: string }> {
  type Node = { type: string; depth?: number; value?: string; children?: Node[] };
  const skipped = new Set(["image", "imageReference", "break", "mdxTextExpression", "mdxFlowExpression"]);
  const text = (node: Node): string =>
    node.type === "text" || node.type === "inlineCode"
      ? node.value ?? ""
      : skipped.has(node.type) ? "" : (node.children ?? []).map(text).join("");
  const tree = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).parse(body) as Node;
  const headings: Node[] = [];
  const walk = (node: Node) => {
    if (node.type === "heading") headings.push(node);
    else node.children?.forEach(walk);
  };
  walk(tree);
  const slug = createSlugger();
  return headings.map((heading) => ({ depth: heading.depth ?? 0, anchor: slug(text(heading)) }));
}

function lessonFiles(): Array<{ route: string; file: string }> {
  return curriculumData.flatMap((tier) =>
    tier.sections.flatMap((section) =>
      section.topics.map((topic) => ({
        route: `/curriculum/${tier.slug}/${section.slug}/${topic.slug}`,
        file: path.join(contentRoot, tier.slug, section.slug, `${topic.slug}.mdx`),
      })),
    ),
  );
}

describe("remarkHeadingIds", () => {
  it("gives every heading the shared slug and repeats get -1, -2 suffixes", () => {
    const { code } = compileWithIds(
      "## Quick Take\n\n## Practice & Reinforce\n\n### Example\n\n### Example\n\n#### Why `<=` matters\n\n### Example\n",
    );
    expect(headingIds(code)).toEqual(["quick-take", "practice--reinforce", "example", "example-1", "why--matters", "example-2"]);
  });

  it("reads text and inline code through emphasis and links, as the rendered heading does", () => {
    const { code, toc } = compileWithIds("## The **`uvm_config_db`** [lookup](/x) rules\n");
    expect(headingIds(code)).toEqual(["the-uvm_config_db-lookup-rules"]);
    expect(toc).toEqual([{ id: "the-uvm_config_db-lookup-rules", text: "The uvm_config_db lookup rules", depth: 2, expert: false }]);
  });

  it("covers headings inside JSX blocks and lists only H2 and H3 in the table of contents", () => {
    const { code, toc } = compileWithIds(
      "# Title\n\n<Panel>\n\n## Inside a panel\n\n#### Deep detail\n\n</Panel>\n\n### Afterwards\n",
    );
    expect(headingIds(code)).toEqual(["title", "inside-a-panel", "deep-detail", "afterwards"]);
    expect(toc.map((entry) => [entry.id, entry.depth])).toEqual([
      ["inside-a-panel", 2],
      ["afterwards", 3],
    ]);
  });

  it("marks the expert layer: Push Further, its subsections and every Expert: heading", () => {
    const { toc } = compileWithIds(
      [
        "## Build Your Mental Model",
        "### Expert: clause 16.14 corner cases",
        "### Basics",
        "## Push Further",
        "### Scale and performance",
        "## Practice & Reinforce",
        "### Quiz",
      ].join("\n\n"),
    );
    expect(toc.map((entry) => [entry.text, entry.expert])).toEqual([
      ["Build Your Mental Model", false],
      ["Expert: clause 16.14 corner cases", true],
      ["Basics", false],
      ["Push Further", true],
      ["Scale and performance", true],
      ["Practice & Reinforce", false],
      ["Quiz", false],
    ]);
  });

  it("adds entries a node carries in data.tocEntries at its position, without using slugs", () => {
    const injectSlot = () => (tree: { children: unknown[] }) => {
      tree.children.splice(1, 0, {
        type: "mdxJsxFlowElement",
        name: "Slot",
        attributes: [],
        children: [],
        data: { tocEntries: [{ id: "slot-entry", text: "Slot entry", depth: 2, expert: false }] },
      });
    };
    const toc: TocEntry[] = [];
    const code = String(compileSync("## First\n\n## Second\n\n## Second\n", {
      remarkPlugins: [injectSlot, [remarkHeadingIds, { toc }]] as never,
    }));
    expect(toc.map((entry) => entry.id)).toEqual(["first", "slot-entry", "second", "second-1"]);
    expect(headingIds(code)).toEqual(["first", "second", "second-1"]);
  });

  it("gives every lesson unique ids that equal the search and expert index anchors", () => {
    const files = lessonFiles();
    expect(files.length).toBeGreaterThan(100);
    for (const { route, file } of files) {
      const body = matter(fs.readFileSync(file, "utf8")).content;
      const { code, toc } = compileWithIds(body);
      const ids = headingIds(code);
      expect(new Set(ids).size, `${route} has duplicate heading ids`).toBe(ids.length);
      expect(ids, `${route} ids differ from the shared index algorithm`).toEqual(
        referenceAnchors(body).map((heading) => heading.anchor),
      );
      for (const entry of toc) expect(ids, `${route}#${entry.id}`).toContain(entry.id);
    }
  }, 120_000);

  it("resolves the curriculum anchors that diagrams link to (G30-OVW-08)", () => {
    const broken: string[] = [];
    let checked = 0;
    for (const href of new Set(Object.values(componentLinkMap))) {
      if (!href || !href.includes("#")) continue;
      checked += 1;
      const [route, anchor] = href.split("#");
      const body = matter(fs.readFileSync(path.join(contentRoot, `${route.replace(/^\/curriculum\//, "")}.mdx`), "utf8")).content;
      if (!headingIds(compileWithIds(body).code).includes(anchor)) broken.push(href);
    }
    expect(checked).toBeGreaterThan(0);
    expect(broken).toEqual([]);
  });
});
